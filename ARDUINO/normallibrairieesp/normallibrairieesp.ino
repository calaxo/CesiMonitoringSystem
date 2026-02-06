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
#include <mbedtls/md.h>

// ===============================
// CONFIGURATION NODE
// ===============================
// Chaque node doit avoir une ADRESSE UNIQUE (0x01-0xFE)
#define NODE_ADDRESS 0x02
#define GATEWAY_ADDRESS 0x00

// Clé de chiffrement (DOIT être la même que la gateway!)
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
#define PIR_INIT_TIME_MS 30000  // Temps d'initialisation du PIR (30 secondes)

// Pins LED Chainable (Grove v2.0)
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

// LED Chainable avec FastLED
#define NUM_LEDS 1
// CRGB leds[NUM_LEDS];  // Non utilisé avec LED intégrée

// Variables pour la tâche de lecture capteurs
TaskHandle_t sensorTaskHandle = NULL;
TaskHandle_t presenceTaskHandle = NULL;
QueueHandle_t sensorQueue;

// Variables de présence (partagées avec synchronisation)
volatile uint16_t presenceCount = 0;      // Compteur de présences détectées
volatile bool currentPresence = false;     // État actuel (pour affichage temps réel)
volatile bool lastPresenceState = false;   // Dernier état pour éviter les logs répétés

// Buffers globaux pour éviter débordement stack
static char g_messageForHmac[80];
static char g_finalMessage[120];   // Réduit de 160
static uint8_t g_hmac[32];
static char g_hmacHex[17];         // Réduit de 65 (16 chars + null)

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
// TÂCHE CALCUL PRÉSENCE (Core 0)
// ===============================
void presenceTask(void *parameter) {
    bool lastMotionState = false;
    unsigned long lastMotionDetectedTime = millis();  // Initialiser au temps actuel
    unsigned long lastMotionEventTime = 0;  // Débounce : ignorer les événements rapides
    const unsigned long MOTION_HOLD_MS = 2000;  // Garder LED ON pendant 2 sec
    const unsigned long MOTION_DEBOUNCE_MS = 500;  // Ignorer les événements < 500ms après le dernier
    
    // Démarrer en OFF
    digitalWrite(LED_PIN, LOW);
    Serial.println("[INIT] LED démarrée en OFF");
    
    while (true) {
        bool currentMotionState = digitalRead(HC_SR501_PIN);
        unsigned long now = millis();
        
        // Détecter transition LOW -> HIGH (mouvement commence)
        if (currentMotionState && !lastMotionState) {
            // Débounce : accepter uniquement si assez de temps depuis le dernier événement
            if (now - lastMotionEventTime > MOTION_DEBOUNCE_MS) {
                lastMotionEventTime = now;
                lastMotionDetectedTime = now;
                presenceCount++;
                Serial.printf("[DETECTED] Mouvement! (event_time=%lu)\n", now);
            }
        }
        lastMotionState = currentMotionState;
        
        // Contrôler la LED selon le temps écoulé
        if (now - lastMotionDetectedTime < MOTION_HOLD_MS) {
            // LED ON si mouvement récent (dans les 2 dernières secondes)
            digitalWrite(LED_PIN, HIGH);
        } else {
            // LED OFF sinon
            digitalWrite(LED_PIN, LOW);
        }
        
        // Afficher l'état toutes les 3 secondes
        static unsigned long lastPrintTime = 0;
        if (now - lastPrintTime > 3000) {
            lastPrintTime = now;
            bool ledState = (now - lastMotionDetectedTime < MOTION_HOLD_MS);
            Serial.printf("[STATUS] PIR=%d | LED=%s | Count=%d\n", 
                         currentMotionState ? 1 : 0, ledState ? "ON" : "OFF", presenceCount);
        }
        
        vTaskDelay(pdMS_TO_TICKS(200));
    }
}

// ===============================
// TÂCHE LECTURE CAPTEURS (Core 1)
// ===============================
void sensorTask(void *parameter) {
    SensorData data;
    
    while (true) {
        // Lire les capteurs BME280
        data.temperature = bme.readTemperature();
        data.humidity = bme.readHumidity();
        data.pressure = bme.readPressure() / 100.0F; // hPa
        data.valid = !isnan(data.temperature);
        
        // La présence sera calculée par la tâche presenceTask
        data.motionDetected = false;  // Sera utilisé pour le message
        
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
    
    // Initialisation LED intégrée
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);  // LED OFF (active HIGH)
    Serial.println("[OK] LED intégrée initialisée sur GPIO" + String(LED_PIN));
    
    // Calibration du capteur PIR (30 secondes)
    Serial.print("[PIR] Calibration...");
    for (int i = 30; i > 0; i--) {
        delay(1000);
    }
    Serial.println(" OK");
    
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
        4096,      // Augmenté de 2048 à 4096
        NULL,
        1,
        &sensorTaskHandle,
        1  // Core 1
    );
    
    // Créer tâche de calcul présence sur Core 0
    xTaskCreatePinnedToCore(
        presenceTask,
        "Presence",
        2048,
        NULL,
        1,
        &presenceTaskHandle,
        0  // Core 0
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
uint16_t motionCounter = 0;  // Compteur pour réinitialisation après envoi

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
            // Convertir température seulement
            char tempStr[8];
            dtostrf(data.temperature, 4, 1, tempStr);
            
            // Déterminer la présence : true si au moins 1 mouvement détecté depuis dernière trame
            bool presenceDetected = (presenceCount >= 1);
            const char* motionStr = presenceDetected ? "true" : "false";
            
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
            
            // Réinitialiser le compteur après envoi
            presenceCount = 0;
        } else {
            // Pas de données capteur, envoyer heartbeat simple
            snprintf(g_finalMessage, sizeof(g_finalMessage), "{\"status\":\"alive\"}");
            Serial.println("[TX] HEARTBEAT");
            net.send(GATEWAY_ADDRESS, (uint8_t *)g_finalMessage, strlen(g_finalMessage));
        }
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
