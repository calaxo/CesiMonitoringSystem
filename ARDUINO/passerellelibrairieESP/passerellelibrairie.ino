/*
 * ===============================
 * GATEWAY LoRa + MQTT pour ESP32 WROOM-32D
 * ===============================
 * 
 * Architecture multithread optimisée:
 *   - Core 0: Tâche LoRa RX (haute priorité)
 *   - Core 0: Tâche MQTT (gérée par AsyncMqttClient)
 *   - Core 1: Application principale
 * 
 * Utilise:
 *   - WiFi natif ESP32
 *   - AsyncMqttClient (non-bloquant)
 *   - FreeRTOS pour le multithread
 *   - HardwareSerial pour LoRa
 */

#include <WiFi.h>
#include <AsyncMqttClient.h>
#include "LoraTwo.h"
#include "config.h"

// ===============================
// CONFIGURATION GATEWAY
// ===============================
LoraTwo net(0x00, true); // Adresse 0x00, mode Gateway

// ===============================
// WIFI & MQTT ASYNC
// ===============================
AsyncMqttClient mqttClient;
TimerHandle_t mqttReconnectTimer;
TimerHandle_t wifiReconnectTimer;

// Buffer MQTT thread-safe
QueueHandle_t mqttQueue;
#define MQTT_QUEUE_SIZE 32

struct MqttMessage {
    char topic[32];
    char payload[128];
    uint8_t qos;
    bool retain;
};

// ===============================
// STATISTIQUES
// ===============================
volatile uint32_t messagesRelayed = 0;
volatile uint32_t mqttPublishFailed = 0;

// ===============================
// TÂCHE MQTT PUBLISHER (Core 0)
// ===============================
void mqttPublishTask(void *parameter) {
    MqttMessage msg;
    
    while (true) {
        if (xQueueReceive(mqttQueue, &msg, portMAX_DELAY) == pdTRUE) {
            if (mqttClient.connected()) {
                uint16_t packetId = mqttClient.publish(msg.topic, msg.qos, msg.retain, 
                                                        msg.payload, strlen(msg.payload));
                if (packetId > 0) {
                    Serial.printf("[MQTT] Publié (id=%d): %s\n", packetId, msg.payload);
                    messagesRelayed++;
                } else {
                    Serial.println("[MQTT] Erreur publication!");
                    mqttPublishFailed++;
                }
            } else {
                Serial.println("[MQTT] Non connecté, message en queue...");
                // Remettre en queue si non connecté
                xQueueSendToFront(mqttQueue, &msg, 0);
                vTaskDelay(pdMS_TO_TICKS(1000));
            }
        }
    }
}

// ===============================
// CALLBACK RÉCEPTION LORA (appelé depuis Core 0)
// ===============================
void onLoraReceive(uint8_t sender, const char *payload, uint8_t len, int rssi, int snr)
{
    Serial.printf("[LORA] Reçu de 0x%02X (RSSI:%d SNR:%d): %s\n", sender, rssi, snr, payload);

    // Préparer le message MQTT
    MqttMessage msg;
    strncpy(msg.topic, MQTT_TOPIC, sizeof(msg.topic) - 1);
    msg.qos = 1;
    msg.retain = false;

    // Convertir l'adresse en string
    char sensorId[5];
    snprintf(sensorId, sizeof(sensorId), "%02X", sender);

    // Construire le JSON avec métadonnées
    if (payload[0] == '{') {
        // Insérer sensor_id et métadonnées au début du JSON
        snprintf(msg.payload, sizeof(msg.payload), 
                 "{\"sensor_id\":\"%s\",\"rssi\":%d,\"snr\":%d,%s",
                 sensorId, rssi, snr, payload + 1);
    } else {
        snprintf(msg.payload, sizeof(msg.payload), 
                 "{\"sensor_id\":\"%s\",\"rssi\":%d,\"snr\":%d,\"data\":\"%s\"}",
                 sensorId, rssi, snr, payload);
    }

    // Envoyer à la queue MQTT (non-bloquant)
    if (xQueueSend(mqttQueue, &msg, 0) != pdTRUE) {
        Serial.println("[MQTT] Queue pleine!");
    }
}

// ===============================
// CALLBACKS WIFI
// ===============================
void WiFiEvent(WiFiEvent_t event) {
    switch(event) {
        case ARDUINO_EVENT_WIFI_STA_GOT_IP:
            Serial.print("[WIFI] Connecté! IP: ");
            Serial.println(WiFi.localIP());
            xTimerStop(wifiReconnectTimer, 0);
            connectToMqtt();
            break;
        case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
            Serial.println("[WIFI] Déconnecté!");
            xTimerStop(mqttReconnectTimer, 0);
            xTimerStart(wifiReconnectTimer, 0);
            break;
        default:
            break;
    }
}

void connectToWifi() {
    Serial.printf("[WIFI] Connexion à %s...\n", WIFI_SSID);
    
    // Configuration IP statique (optionnel)
    #ifdef USE_STATIC_IP
    IPAddress ip(IP_ADDRESS);
    IPAddress gateway(GATEWAY_IP);
    IPAddress subnet(SUBNET);
    IPAddress dns(DNS);
    WiFi.config(ip, gateway, subnet, dns);
    #endif
    
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

// ===============================
// CALLBACKS MQTT ASYNC
// ===============================
void connectToMqtt() {
    Serial.println("[MQTT] Connexion...");
    mqttClient.connect();
}

void onMqttConnect(bool sessionPresent) {
    Serial.println("[MQTT] Connecté!");
    
    // Publier message de statut
    char statusMsg[64];
    snprintf(statusMsg, sizeof(statusMsg), 
             "{\"gateway\":\"online\",\"ip\":\"%s\"}", 
             WiFi.localIP().toString().c_str());
    mqttClient.publish("gateway/status", 1, true, statusMsg);
}

void onMqttDisconnect(AsyncMqttClientDisconnectReason reason) {
    Serial.printf("[MQTT] Déconnecté (raison: %d)\n", (int)reason);
    
    if (WiFi.isConnected()) {
        xTimerStart(mqttReconnectTimer, 0);
    }
}

void onMqttPublish(uint16_t packetId) {
    // Publication confirmée (QoS 1/2)
}

// ===============================
// SETUP
// ===============================
void setup()
{
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n=== GATEWAY LoRa + MQTT ESP32 ===");
    Serial.printf("CPU: %d MHz, Cores: 2\n", ESP.getCpuFreqMHz());
    Serial.printf("Free Heap: %d bytes\n", ESP.getFreeHeap());

    // Créer la queue MQTT
    mqttQueue = xQueueCreate(MQTT_QUEUE_SIZE, sizeof(MqttMessage));

    // Timers pour reconnexion
    mqttReconnectTimer = xTimerCreate("mqttTimer", pdMS_TO_TICKS(2000), 
                                       pdFALSE, (void*)0, 
                                       [](TimerHandle_t timer) { connectToMqtt(); });
    wifiReconnectTimer = xTimerCreate("wifiTimer", pdMS_TO_TICKS(2000), 
                                       pdFALSE, (void*)0, 
                                       [](TimerHandle_t timer) { connectToWifi(); });

    // Configurer WiFi
    WiFi.onEvent(WiFiEvent);
    WiFi.mode(WIFI_STA);
    
    // Configurer MQTT
    mqttClient.onConnect(onMqttConnect);
    mqttClient.onDisconnect(onMqttDisconnect);
    mqttClient.onPublish(onMqttPublish);
    mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
    mqttClient.setClientId(MQTT_CLIENT);
    
    // Credentials MQTT si nécessaire
    #ifdef MQTT_USER
    mqttClient.setCredentials(MQTT_USER, MQTT_PASS);
    #endif

    // Démarrer WiFi
    connectToWifi();

    // Créer la tâche de publication MQTT sur Core 0
    xTaskCreatePinnedToCore(
        mqttPublishTask,
        "MQTT_Pub",
        4096,
        NULL,
        1,
        NULL,
        0  // Core 0
    );

    // Initialiser LoRa sur Serial2 (GPIO16=RX, GPIO17=TX)
    Serial2.begin(9600, SERIAL_8N1, LORA_RX_PIN, LORA_TX_PIN);
    
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

void loop()
{
    // Afficher statistiques toutes les 30 secondes
    if (millis() - lastStats > 30000) {
        lastStats = millis();
        
        Serial.println("\n--- STATISTIQUES ---");
        Serial.printf("Messages relayés: %d\n", messagesRelayed);
        Serial.printf("Paquets LoRa reçus: %d\n", net.getPacketsReceived());
        Serial.printf("Erreurs MQTT: %d\n", mqttPublishFailed);
        Serial.printf("WiFi RSSI: %d dBm\n", WiFi.RSSI());
        Serial.printf("Free Heap: %d bytes\n", ESP.getFreeHeap());
        Serial.println("--------------------\n");
    }

    // Le reste est géré par les tâches FreeRTOS
    vTaskDelay(pdMS_TO_TICKS(100));
}
