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
 * 
 * Mode Deep Sleep disponible pour économie d'énergie
 */

#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include "LoraTwo.h"

// ===============================
// CONFIGURATION NODE
// ===============================
// Chaque node doit avoir une ADRESSE UNIQUE (0x01-0xFE)
#define NODE_ADDRESS 0x02
#define GATEWAY_ADDRESS 0x00

// Clé de chiffrement (DOIT être la même que la gateway!)
#define LORA_ENCRYPTION_KEY 0xCAFEBABE

// Pins LoRa (Serial2 sur ESP32)
#define LORA_RX_PIN 16
#define LORA_TX_PIN 17

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

struct SensorData {
    float temperature;
    float humidity;
    float pressure;
    bool valid;
};

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
    
    while (true) {
        // Lire les capteurs
        data.temperature = bme.readTemperature();
        data.humidity = bme.readHumidity();
        data.pressure = bme.readPressure() / 100.0F; // hPa
        data.valid = !isnan(data.temperature);
        
        // Envoyer à la queue
        xQueueOverwrite(sensorQueue, &data);
        
        // Attendre avant prochaine lecture
        vTaskDelay(pdMS_TO_TICKS(1000));  // Lecture toutes les secondes
    }
}

// ===============================
// SETUP
// ===============================
void setup()
{
    Serial.begin(115200);
    delay(1000);
    
    Serial.println("\n=== NODE LoRa ESP32 ===");
    Serial.printf("Adresse: 0x%02X\n", NODE_ADDRESS);
    Serial.printf("CPU: %d MHz, Cores: 2\n", ESP.getCpuFreqMHz());
    Serial.printf("Free Heap: %d bytes\n", ESP.getFreeHeap());

    // Initialisation I2C pour BME280
    Wire.begin(21, 22);  // SDA=GPIO21, SCL=GPIO22 (défaut ESP32)
    
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
        bme.setSampling(Adafruit_BME280::MODE_FORCED,
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
        2048,
        NULL,
        1,
        &sensorTaskHandle,
        1  // Core 1
    );

    // Initialiser LoRa
    Serial.printf("[LORA] Init sur GPIO%d(RX)/GPIO%d(TX)\n", LORA_RX_PIN, LORA_TX_PIN);
    Serial2.begin(9600, SERIAL_8N1, LORA_RX_PIN, LORA_TX_PIN);
    
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

    // Envoi périodique
    if (now - lastSend >= SEND_INTERVAL_MS)
    {
        lastSend = now;
        messageCount++;
        
        // Récupérer données capteurs depuis la queue
        SensorData data;
        if (xQueuePeek(sensorQueue, &data, 0) == pdTRUE && data.valid) {
            // Formater le message JSON
            char message[96];
            
            // Convertir les floats en strings (plus fiable sur ESP32)
            char tempStr[10], humStr[10], pressStr[10];
            dtostrf(data.temperature, 4, 1, tempStr);
            dtostrf(data.humidity, 4, 1, humStr);
            dtostrf(data.pressure, 6, 1, pressStr);
            
            snprintf(message, sizeof(message), 
                     "{\"t\":%s,\"h\":%s,\"p\":%s,\"n\":%d}",
                     tempStr, humStr, pressStr, messageCount);

            Serial.printf("[TX] Envoi #%d: %s\n", messageCount, message);
            
            if (!net.send(GATEWAY_ADDRESS, (uint8_t *)message, strlen(message))) {
                Serial.println("[ERREUR] Queue d'envoi pleine!");
            }
        } else {
            // Pas de données capteur, envoyer message de test
            char message[48];
            snprintf(message, sizeof(message), "{\"status\":\"alive\",\"n\":%d}", messageCount);
            
            Serial.printf("[TX] Envoi heartbeat #%d\n", messageCount);
            net.send(GATEWAY_ADDRESS, (uint8_t *)message, strlen(message));
        }
    }

    // Afficher statistiques toutes les 60 secondes
    static unsigned long lastStats = 0;
    if (now - lastStats > 60000) {
        lastStats = now;
        
        Serial.println("\n--- STATISTIQUES NODE ---");
        Serial.printf("Messages envoyés: %d\n", messageCount);
        Serial.printf("Paquets TX: %d\n", net.getPacketsSent());
        Serial.printf("Paquets perdus: %d\n", net.getPacketsLost());
        Serial.printf("Free Heap: %d bytes\n", ESP.getFreeHeap());
        Serial.println("-------------------------\n");
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
