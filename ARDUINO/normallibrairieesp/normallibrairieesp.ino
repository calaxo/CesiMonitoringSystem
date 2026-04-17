/*
 * ===============================
 * NODE LoRa pour ESP32 WROOM-32D
 * ===============================
 * 
 * Architecture multithread optimisée:
 *   - Core 0: Tâche LoRa RX (réception, gérée par la librairie)
 *   - Core 1: Application (lecture capteurs, envoi)
 * 
 * Capteurs:
 *   - BME280 (I2C): Température, Humidité, Pression
 *   - capteur PIR pour mouvements
 * 
 * Mode Deep Sleep disponible pour économie d'énergie
 */

#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include "LoraTwoesp.h"
#include <mbedtls/md.h>

// ===============================
// CONFIGURATION NODE
// ===============================
// Chaque node doit avoir une ADRESSE UNIQUE (0x01-0xFE)
#define NODE_ADDRESS 0x02
#define GATEWAY_ADDRESS 0x00

// Clé de chiffrement de la librairie lroa  entre tout les diférents nodes en HEXA
#define LORA_ENCRYPTION_KEY 0xCAFEBABE

// Clé secrète HMAC (DOIT être la même que la gateway!)
const uint8_t HMAC_KEY[] = {0xCA, 0xFE, 0xBA, 0xBE, 0xDE, 0xAD, 0xBE, 0xEF, 
                           0xCA, 0xFE, 0xBA, 0xBE, 0xDE, 0xAD, 0xBE, 0xEF};
const size_t HMAC_KEY_LEN = sizeof(HMAC_KEY);

// Pins LoRa (Serial2 sur ESP32)
#define LORA_RX_PIN 16
#define LORA_TX_PIN 17

// Pin HC-SR501 (capteur mouvement PIR)
#define HC_SR501_PIN 13

// Pins intégrées a l'ESP32
#define LED_PIN 2   // LED intégrée ESP32

// Intervalle d'envoi
#define SEND_INTERVAL_MS 5000  // 5 secondes

// Mode économie d'énergie (optionnel)
// #define ENABLE_DEEP_SLEEP
#define DEEP_SLEEP_DURATION_US 30000000  // 30 secondes en µs

// ===============================
// OBJETS GLOBAUX
// ===============================
LoraTwo net(NODE_ADDRESS);
Adafruit_BME280 bme;

// Variables pour la tâche de lecture capteurs
TaskHandle_t sensorTaskHandle = NULL;
QueueHandle_t sensorQueue;

// Buffers globaux pour éviter débordement stack
static char g_messageForHmac[80];
static char g_finalMessage[120];   // Réduit de 160
static uint8_t g_hmac[32];
static char g_hmacHex[17];         // Réduit de 65 (16 chars + null)

// Mémorisation du mouvement détecté depuis le dernier envoi
volatile bool g_motionDetected = false;

struct SensorData {
    float temperature;
    float humidity;
    float pressure;
    bool motionDetected;
    bool valid;
};

// ===============================
// FONCTION HMAC OPTIMISÉE (8 bytes tronqués)
// ===============================
void computeHmac(const char* message, char* hmacHexOutput) {
    // Calculer le HMAC SHA256
    mbedtls_md_context_t ctx;
    mbedtls_md_init(&ctx);
    mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 1);
    mbedtls_md_hmac_starts(&ctx, HMAC_KEY, HMAC_KEY_LEN);
    mbedtls_md_hmac_update(&ctx, (uint8_t*)message, strlen(message));
    mbedtls_md_hmac_finish(&ctx, g_hmac);
    mbedtls_md_free(&ctx);
    
    // Convertir en hex SEULEMENT les 8 premiers bytes (16 chars)
    memset(hmacHexOutput, 0, 17);
    for (int i = 0; i < 8; i++) {  // 8 bytes au lieu de 32
        snprintf(&hmacHexOutput[i*2], 3, "%02x", g_hmac[i]);
    }
}

// ===============================
// CALLBACK ÉVÉNEMENTS LORA
// ===============================
void onLoraEvent(uint8_t eventType, uint8_t addr, uint8_t seq) {
    switch (eventType) {
        case LORA_EVENT_ACK_RECEIVED:
            Serial.printf("[EVENT] ACK reçu de 0x%02X (seq=%d)\n", addr, seq);
            break;
        case LORA_EVENT_SEND_FAILED:
            Serial.printf("[EVENT] Échec envoi vers 0x%02X (seq=%d)\n", addr, seq);
            break;
        default:
            break;
    }
}

// ===============================
// TÂCHE LECTURE CAPTEURS (Core 1)
// ===============================
void sensorTask(void *parameter) {
    SensorData data;
    memset(&data, 0, sizeof(data));  // Initialiser à zéro
    
    // Forcer une première lecture immédiate
    data.temperature = bme.readTemperature();
    data.valid = !isnan(data.temperature);
    data.motionDetected = false;
    
    while (true) {
        // Lire les capteurs BME280 (moins souvent, tous les 1000ms)
        static unsigned long lastBmeRead = 0;
        if (millis() - lastBmeRead >= 1000) {
            lastBmeRead = millis();
            // MODE_FORCED: le capteur fait une mesure puis se remet en sleep
            // Il faut attendre que la mesure soit prête
            data.temperature = bme.readTemperature();         
            data.valid = !isnan(data.temperature);
            Serial.printf("[TEMP] %.1f°C | Valid: %d\n", data.temperature, data.valid);
            
            // Donner du temps pour la prochaine mesure
            delay(10);
        }
        
        // Lire le capteur PIR très souvent (tous les 50ms)
        // Si mouvement détecté, mémoriser l'état jusqu'au prochain envoi
        if (digitalRead(HC_SR501_PIN)) {
            g_motionDetected = true;
        }
        data.motionDetected = g_motionDetected;
        
        // Envoyer à la queue
        xQueueOverwrite(sensorQueue, &data);
        
        // Délai court pour lecture fréquente du PIR
        vTaskDelay(pdMS_TO_TICKS(50));  // Lecture PIR toutes les 50ms
        
    }
}
// ===============================
// SETUP
// ===============================
void setup()
{
    Serial.begin(115200);  // Augmenté de 9600 à 115200
    delay(1000);
    
    // Augmenter la taille du stack du loop (Core 0) via préprocesseur
    // CONFIG_ARDUINO_LOOP_STACK_SIZE sera utilisé automatiquement
    
    Serial.println("\n=== NODE LoRa ESP32 ===");
    Serial.printf("Addr: 0x%02X | Heap: %d bytes\n", NODE_ADDRESS, ESP.getFreeHeap());

    // Initialisation I2C pour BME280
    Wire.begin(21, 22);  // SDA=GPIO21, SCL=GPIO22 (défaut ESP32)
    
    // Initialisation HC-SR501
    pinMode(HC_SR501_PIN, INPUT);
    Serial.println("[OK] HC-SR501 initialisé sur GPIO" + String(HC_SR501_PIN));
    
    // Attendre que le capteur PIR se stabilise
    Serial.println("[INIT] Stabilisation du PIR en cours... (5 secondes)");
    delay(5000);  // Laisser le temps au capteur de se stabiliser
    Serial.println("[OK] PIR stabilisé");
    
    // Initialisation LED intégrée
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);  // LED OFF au démarrage
    Serial.println("[OK] LED initialisée sur GPIO" + String(LED_PIN));
    
    // Initialisation BME280
    if (!bme.begin(0x76)) {  // ou 0x77 selon le module
        Serial.println("[ERREUR] BME280 non trouvé!");
        Serial.println("Vérifiez le câblage I2C:");
        Serial.println("  VCC -> 3.3V");
        Serial.println("  GND -> GND");
        Serial.println("  SDA -> GPIO21");
        Serial.println("  SCL -> GPIO22");
        
        // Continuer quand même pour les tests
    } else {
        Serial.println("[OK] BME280 initialisé");
        
        // Configuration BME280 pour basse consommation
        bme.setSampling(Adafruit_BME280::MODE_NORMAL,
                        Adafruit_BME280::SAMPLING_X1,  // Température
                        Adafruit_BME280::SAMPLING_X1,  // Pression
                        Adafruit_BME280::SAMPLING_X1,  // Humidité
                        Adafruit_BME280::FILTER_OFF);
    }

    // Créer queue pour les données capteurs
    sensorQueue = xQueueCreate(1, sizeof(SensorData));

    // Créer tâche de lecture capteurs sur Core 1
    xTaskCreatePinnedToCore(
        sensorTask,
        "Sensors",
        4096,      // Augmenté de 2048 à 4096
        NULL,
        1,
        &sensorTaskHandle,
        1  // Core 1
    );
    
    // Initialiser LoRa
    Serial.printf("[LORA] Init sur GPIO%d(RX)/GPIO%d(TX)\n", LORA_RX_PIN, LORA_TX_PIN);
    Serial2.begin(9600, SERIAL_8N1, LORA_RX_PIN, LORA_TX_PIN);
    
    // Test de communication avec le module
    delay(500);
    Serial.println("[DEBUG] Test de réponse du module LoRa...");
    Serial2.write("AT\r\n");
    delay(500);
    
    if (Serial2.available()) {
        String response = "";
        while (Serial2.available()) {
            response += (char)Serial2.read();
        }
        Serial.printf("[LORA] Module a répondu: %s\n", response.c_str());
    } else {
        Serial.println("[ERREUR] Module LoRa NE REPOND PAS! Vérifiez:");
        Serial.println("  - Alimentation du module");
        Serial.println("  - Câblage RX/TX (TX ESP->RX module, RX ESP->TX module)");
        Serial.println("  - Les GPIO 16 et 17 sont libres");
    }
    
    net.setEncryptionKey(LORA_ENCRYPTION_KEY);
    net.setEventCallback(onLoraEvent);
    net.begin(&Serial2);

    Serial.println("[INIT] Node prêt!");
    Serial.printf("[INIT] Intervalle envoi: %d ms\n", SEND_INTERVAL_MS);
}

// ===============================
// LOOP (Core 1)
// ===============================
unsigned long lastSend = 0;
uint32_t messageCount = 0;

void loop()
{
    unsigned long now = millis();
    
    // Contrôler la LED intégrée selon le PIR en temps réel
    digitalWrite(LED_PIN, digitalRead(HC_SR501_PIN) ? HIGH : LOW);

    // Envoi périodique
    if (now - lastSend >= SEND_INTERVAL_MS)
    {
        lastSend = now;
        messageCount++;
        
        // Récupérer données capteurs depuis la queue
        SensorData data;
        if (xQueuePeek(sensorQueue, &data, 0) == pdTRUE && data.valid) {
            // Convertir température
            char tempStr[8];
            dtostrf(data.temperature, 4, 1, tempStr);
            
            // Déterminer motion: utiliser la variable mémorisée
            const char* motionStr = data.motionDetected ? "true" : "false";
            
            // Créer message pour HMAC
            snprintf(g_messageForHmac, sizeof(g_messageForHmac), 
                     "{\"t\":%s,\"m\":%s}",
                     tempStr, motionStr);
            
            // Calculer HMAC
            computeHmac(g_messageForHmac, g_hmacHex);
            
            // Créer message final avec HMAC
            snprintf(g_finalMessage, sizeof(g_finalMessage), 
                     "{\"t\":%s,\"m\":%s,\"hmac\":\"%s\"}",
                     tempStr, motionStr, g_hmacHex);
            
            Serial.print("[TX] m:");
            Serial.println(motionStr);
            
            if (!net.send(GATEWAY_ADDRESS, (uint8_t *)g_finalMessage, strlen(g_finalMessage))) {
                Serial.println("[ERREUR] Queue pleine!");
            }
        } else {
            // Pas de données capteur, envoyer heartbeat simple
            snprintf(g_finalMessage, sizeof(g_finalMessage), "{\"status\":\"alive\"}");
            Serial.println("[TX] HEARTBEAT");
            net.send(GATEWAY_ADDRESS, (uint8_t *)g_finalMessage, strlen(g_finalMessage));
        }
        
        // Réinitialiser TOUJOURS la détection de mouvement après l'envoi
        // (qu'il y ait eu des données ou un heartbeat)
        g_motionDetected = false;
    }

    // Afficher statistiques toutes les 60 secondes
    static unsigned long lastStats = 0;
    if (now - lastStats > 60000) {
        lastStats = now;
        
        Serial.printf("STATS | TX:%d | Lost:%d | Heap:%d\n", 
                     net.getPacketsSent(), net.getPacketsLost(), ESP.getFreeHeap());
    }

    #ifdef ENABLE_DEEP_SLEEP
    // Mode Deep Sleep pour économie d'énergie
    if (now - lastSend >= SEND_INTERVAL_MS - 1000) {
        Serial.println("[SLEEP] Entrée en deep sleep...");
        net.stop();  // Arrêter proprement les tâches LoRa
        esp_sleep_enable_timer_wakeup(DEEP_SLEEP_DURATION_US);
        esp_deep_sleep_start();
    }
    #endif

    // Petit délai pour ne pas saturer le CPU
    vTaskDelay(pdMS_TO_TICKS(50));
}
