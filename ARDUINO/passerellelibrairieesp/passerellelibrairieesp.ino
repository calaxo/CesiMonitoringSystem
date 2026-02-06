/*
 * ===============================
 * GATEWAY LoRa + MQTT pour ESP32 WROOM-32D
 * ===============================
 *
 * Architecture multithread optimisée:
 *   - Core 0: Tâche LoRa RX (haute priorité)
 *   - Core 1: Application principale + MQTT
 *
 * Utilise:
 *   - WiFi natif ESP32
 *   - PubSubClient (bloquant mais stable)
 *   - FreeRTOS pour le multithread LoRa
 *   - HardwareSerial pour LoRa
 */

#include <WiFi.h>
#include <WiFiClient.h>
#include <PubSubClient.h>
#include "LoraTwoesp.h"
#include "config.h"

// ===============================
// CONFIGURATION GATEWAY
// ===============================
LoraTwo net(0x00, true); // Adresse 0x00, mode Gateway

// ===============================
// WIFI & MQTT
// ===============================
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// Buffer MQTT thread-safe
QueueHandle_t mqttQueue;
#define MQTT_QUEUE_SIZE 32

struct MqttMessage
{
    char topic[32];
    char payload[128];
    bool retain;
};

// État connexion
volatile bool wifiConnected = false;
volatile bool mqttConnected = false;

// ===============================
// STATISTIQUES
// ===============================
volatile uint32_t messagesRelayed = 0;
volatile uint32_t mqttPublishFailed = 0;

// ===============================
// CALLBACK RÉCEPTION LORA (appelé depuis Core 0)
// ===============================
void onLoraReceive(uint8_t sender, const char *payload, uint8_t len, int rssi, int snr)
{
    Serial.printf("[LORA] Reçu de 0x%02X (RSSI:%d SNR:%d): %s\n", sender, rssi, snr, payload);

    // Préparer le message MQTT
    MqttMessage msg;
    strncpy(msg.topic, MQTT_TOPIC, sizeof(msg.topic) - 1);
    msg.retain = false;

    // Convertir l'adresse en string
    char sensorId[5];
    snprintf(sensorId, sizeof(sensorId), "%02X", sender);

    // Construire le JSON avec métadonnées
    if (payload[0] == '{')
    {
        // Insérer sensor_id et métadonnées au début du JSON
        snprintf(msg.payload, sizeof(msg.payload),
                 "{\"sensor_id\":\"%s\",\"rssi\":%d,\"snr\":%d,%s",
                 sensorId, rssi, snr, payload + 1);
    }
    else
    {
        snprintf(msg.payload, sizeof(msg.payload),
                 "{\"sensor_id\":\"%s\",\"rssi\":%d,\"snr\":%d,\"data\":\"%s\"}",
                 sensorId, rssi, snr, payload);
    }

    // Envoyer à la queue MQTT (non-bloquant)
    if (xQueueSend(mqttQueue, &msg, 0) != pdTRUE)
    {
        Serial.println("[MQTT] Queue pleine!");
    }
}

// ===============================
// CONNEXION WIFI (bloquante)
// ===============================
void connectToWifi()
{
    Serial.printf("[WIFI] Connexion à %s", WIFI_SSID);

    WiFi.mode(WIFI_STA);

#ifdef USE_STATIC_IP
    // Configuration IP statique (réseau sans DHCP)
    IPAddress ip(IP_ADDRESS);
    IPAddress gateway(GATEWAY_IP);
    IPAddress subnet(SUBNET);
    IPAddress dns(DNS);

    if (!WiFi.config(ip, gateway, subnet, dns))
    {
        Serial.println("\n[WIFI] Erreur config IP statique!");
    }
    else
    {
        Serial.printf(" (IP fixe: %d.%d.%d.%d)", ip[0], ip[1], ip[2], ip[3]);
    }
#endif

    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20)
    {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED)
    {
        wifiConnected = true;
        Serial.println();
        Serial.print("[WIFI] Connecté! IP: ");
        Serial.println(WiFi.localIP());
    }
    else
    {
        Serial.println("\n[WIFI] Échec connexion!");
        wifiConnected = false;
    }
}

// ===============================
// CONNEXION MQTT
// ===============================
void connectToMqtt()
{
    if (!wifiConnected)
        return;

    Serial.println("[MQTT] Connexion...");

#ifdef MQTT_USER
    if (mqttClient.connect(MQTT_CLIENT, MQTT_USER, MQTT_PASS))
    {
#else
    if (mqttClient.connect(MQTT_CLIENT))
    {
#endif
        mqttConnected = true;
        Serial.println("[MQTT] Connecté!");

        // Publier message de statut
        char statusMsg[64];
        snprintf(statusMsg, sizeof(statusMsg),
                 "{\"gateway\":\"online\",\"ip\":\"%s\"}",
                 WiFi.localIP().toString().c_str());
        mqttClient.publish("gateway/status", statusMsg, true);
    }
    else
    {
        mqttConnected = false;
        Serial.printf("[MQTT] Échec (code: %d)\n", mqttClient.state());
    }
}

// ===============================
// TRAITEMENT QUEUE MQTT
// ===============================
void processMqttQueue()
{
    MqttMessage msg;

    // Traiter jusqu'à 5 messages par cycle
    int processed = 0;
    while (xQueueReceive(mqttQueue, &msg, 0) == pdTRUE && processed < 5)
    {
        if (mqttConnected && mqttClient.connected())
        {
            if (mqttClient.publish(msg.topic, msg.payload, msg.retain))
            {
                Serial.printf("[MQTT] Publié: %s\n", msg.payload);
                messagesRelayed++;
            }
            else
            {
                Serial.println("[MQTT] Erreur publication!");
                mqttPublishFailed++;
                // Remettre en queue
                xQueueSendToFront(mqttQueue, &msg, 0);
                break;
            }
        }
        else
        {
            // Remettre en queue si non connecté
            xQueueSendToFront(mqttQueue, &msg, 0);
            break;
        }
        processed++;
    }
}

// ===============================
// SETUP
// ===============================
void setup()
{
    Serial.begin(115200);
    delay(2000); // Délai important pour stabilité ESP32

    Serial.println("\n=== GATEWAY LoRa + MQTT ESP32 ===");
    Serial.printf("CPU: %d MHz, Cores: 2\n", ESP.getCpuFreqMHz());
    Serial.printf("Free Heap: %d bytes\n", ESP.getFreeHeap());

    // Créer la queue MQTT
    mqttQueue = xQueueCreate(MQTT_QUEUE_SIZE, sizeof(MqttMessage));

    // Connexion WiFi (bloquante au démarrage)
    connectToWifi();

    // Attendre que le stack TCP soit complètement prêt
    delay(1000);

    // Configurer MQTT
    mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
    mqttClient.setBufferSize(256);

    // Connexion MQTT
    if (wifiConnected)
    {
        connectToMqtt();
    }

    // Initialiser LoRa sur Serial2 (GPIO16=RX, GPIO17=TX)
    Serial2.begin(9600, SERIAL_8N1, LORA_RX_PIN, LORA_TX_PIN);
    delay(100);

    net.setEncryptionKey(LORA_ENCRYPTION_KEY);
    net.setReceiveCallbackEx(onLoraReceive);
    net.begin(&Serial2);

    Serial.println("[INIT] Gateway prête!");
    Serial.printf("[INIT] LoRa sur GPIO%d(RX)/GPIO%d(TX)\n", LORA_RX_PIN, LORA_TX_PIN);
}

// ===============================
// LOOP (Core 1)
// ===============================
unsigned long lastStats = 0;
unsigned long lastReconnect = 0;

void loop()
{
    // Maintenir connexion MQTT
    if (wifiConnected && mqttConnected)
    {
        mqttClient.loop();
    }

    // Traiter la queue MQTT
    processMqttQueue();

    // Reconnexion automatique (toutes les 5 secondes si déconnecté)
    if (millis() - lastReconnect > 5000)
    {
        lastReconnect = millis();

        // Vérifier WiFi
        if (WiFi.status() != WL_CONNECTED)
        {
            wifiConnected = false;
            mqttConnected = false;
            Serial.println("[WIFI] Reconnexion...");
            connectToWifi();
        }

        // Vérifier MQTT
        if (wifiConnected && !mqttClient.connected())
        {
            mqttConnected = false;
            connectToMqtt();
        }
    }

    // Afficher statistiques toutes les 30 secondes
    if (millis() - lastStats > 30000)
    {
        lastStats = millis();

        Serial.println("\n--- STATISTIQUES ---");
        Serial.printf("Messages relayés: %d\n", messagesRelayed);
        Serial.printf("Paquets LoRa reçus: %d\n", net.getPacketsReceived());
        Serial.printf("Erreurs MQTT: %d\n", mqttPublishFailed);
        Serial.printf("WiFi: %s (RSSI: %d dBm)\n",
                      wifiConnected ? "OK" : "DÉCONNECTÉ", WiFi.RSSI());
        Serial.printf("MQTT: %s\n", mqttConnected ? "OK" : "DÉCONNECTÉ");
        Serial.printf("Free Heap: %d bytes\n", ESP.getFreeHeap());
        Serial.println("--------------------\n");
    }

    delay(10); // Petit délai pour éviter watchdog
}
