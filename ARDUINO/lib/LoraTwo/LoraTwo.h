/*
 * ===============================
 * LoraTwo - Librairie LoRa optimisée pour ESP32
 * ===============================
 *
 * Version ESP32 avec:
 *   - FreeRTOS multithread (dual-core)
 *   - Queues pour communication inter-tâches
 *   - Mutex pour protection des ressources
 *   - Callbacks asynchrones
 *   - HardwareSerial natif (performant)
 *
 * FONCTIONNALITÉS:
 *   - Envoi de messages avec accusé de réception (ACK)
 *   - Retries automatiques si pas de réponse
 *   - Découverte automatique des nodes
 *   - Broadcast vers tous les appareils
 *   - CHIFFREMENT XOR des trames (rapide et léger)
 *   - Réception sur Core 0, App sur Core 1
 *
 * UTILISATION RAPIDE:
 *
 *   // Créer une gateway (passerelle)
 *   LoraTwo net(0x00, true);
 *
 *   // Créer un node (capteur)
 *   LoraTwo net(0x02);
 *
 *   // Définir la clé de chiffrement (MÊME clé sur tous les appareils!)
 *   net.setEncryptionKey(0xDEADBEEF);
 *
 *   // Initialiser avec Serial2 (GPIO16=RX, GPIO17=TX)
 *   net.begin(&Serial2);
 *
 *   // Envoyer un message (sera chiffré automatiquement)
 *   char msg[] = "Hello!";
 *   net.send(0x00, (uint8_t*)msg, strlen(msg));
 *
 *   // Pas besoin d'appeler update() - tout est géré en background!
 *
 * ===============================
 */

#ifndef LORATWO_H
#define LORATWO_H

#include <Arduino.h>
#include <Stream.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"

// ===============================
// CLÉ DE CHIFFREMENT PAR DÉFAUT
// ===============================
// IMPORTANT: Change cette valeur et utilise la MÊME sur tous tes appareils!
#define LORATWO_DEFAULT_KEY 0x12345678

// ===============================
// CONSTANTES RÉSEAU
// ===============================

#define LORATWO_BROADCAST 0xFF // Adresse pour envoyer à tous
#define LORATWO_MAX_PAYLOAD 48 // Taille max d'un message (octets)
#define LORATWO_MAX_NODES 32   // Nombre max de nodes sur le réseau
#define LORATWO_MAX_PENDING 16 // Nombre max de messages en attente d'ACK (augmenté pour ESP32)

#define LORATWO_ACK_TIMEOUT 4000 // Délai avant retry (ms)
#define LORATWO_MAX_RETRY 3      // Nombre de tentatives max

// ===============================
// CONFIGURATION ESP32
// ===============================
#define LORATWO_TASK_STACK_SIZE 4096 // Taille stack pour les tâches FreeRTOS
#define LORATWO_RX_QUEUE_SIZE 16     // Taille de la queue de réception
#define LORATWO_TX_QUEUE_SIZE 16     // Taille de la queue d'envoi
#define LORATWO_CORE_RX 0            // Core pour la réception LoRa
#define LORATWO_CORE_TX 1            // Core pour l'envoi et le traitement
#define LORATWO_TASK_PRIORITY_RX 2   // Priorité tâche réception (haute)
#define LORATWO_TASK_PRIORITY_TX 1   // Priorité tâche envoi

// ===============================
// CALLBACK POUR RÉCEPTION
// ===============================

// Type de fonction callback appelée à chaque message reçu
// Paramètres: senderAddress, payload (string), length
typedef void (*LoraReceiveCallback)(uint8_t sender, const char *payload, uint8_t len);

// Callback étendu avec RSSI et SNR
typedef void (*LoraReceiveCallbackEx)(uint8_t sender, const char *payload, uint8_t len, int rssi, int snr);

// Callback pour événements (ACK reçu, timeout, etc.)
typedef void (*LoraEventCallback)(uint8_t eventType, uint8_t addr, uint8_t seq);

// Types d'événements
enum LoraEvent : uint8_t
{
    LORA_EVENT_ACK_RECEIVED = 0x01,    // ACK reçu avec succès
    LORA_EVENT_SEND_FAILED = 0x02,     // Échec envoi après max retries
    LORA_EVENT_NODE_DISCOVERED = 0x03, // Nouveau node découvert
    LORA_EVENT_SEND_OK = 0x04          // Message envoyé (pour gateway)
};

// ===============================
// TYPES DE PAQUETS
// ===============================

enum LoraTwoPacketType : uint8_t
{
    L2_PKT_DATA = 0x01,     // Message de données
    L2_PKT_ACK = 0x02,      // Accusé de réception
    L2_PKT_DISCOVER = 0x03, // Découverte réseau
    L2_PKT_OFFER = 0x04     // Réponse de la gateway
};

// ===============================
// STRUCTURE DE PAQUET
// ===============================

struct LoraTwoPacket
{
    uint8_t src;                          // Adresse source
    uint8_t dst;                          // Adresse destination
    uint8_t type;                         // Type de paquet
    uint8_t seq;                          // Numéro de séquence
    uint8_t len;                          // Longueur du payload
    uint8_t payload[LORATWO_MAX_PAYLOAD]; // Données
    int rssi;                             // Force du signal
    int snr;                              // Rapport signal/bruit
};

// ===============================
// STRUCTURE NODE
// ===============================

struct LoraTwoNode
{
    uint8_t addr;           // Adresse du node
    bool active;            // Node actif?
    unsigned long lastSeen; // Dernier contact
    int lastRssi;           // Dernier RSSI
};

// ===============================
// PACKET EN ATTENTE (ACK)
// ===============================

struct PendingPacket
{
    uint8_t dst;
    LoraTwoPacketType type;
    uint8_t seq;
    uint8_t len;
    uint8_t payload[LORATWO_MAX_PAYLOAD];
    unsigned long timestamp;
    int retries;
    bool active;
};

// ===============================
// MESSAGE POUR QUEUE TX
// ===============================
struct TxMessage
{
    uint8_t dst;
    uint8_t type;
    uint8_t seq;
    uint8_t len;
    uint8_t payload[LORATWO_MAX_PAYLOAD];
    bool needsAck;
};

// ===============================
// CLASSE PRINCIPALE
// ===============================

class LoraTwo
{
public:
    /*
     * Constructeur
     *
     * @param myAddr    Adresse de cet appareil (0x00-0xFE)
     *                  - 0x00 = Gateway (recommandé)
     *                  - 0x01-0xFE = Nodes
     *                  - 0xFF = réservé (broadcast)
     *
     * @param isGateway true = cet appareil est la gateway
     *                  false = cet appareil est un node (défaut)
     *
     * Exemples:
     *   LoraTwo net(0x00, true);   // Gateway
     *   LoraTwo net(0x01);         // Node #1
     *   LoraTwo net(0x02);         // Node #2
     */
    LoraTwo(uint8_t myAddr, bool isGateway = false);

    /*
     * Destructeur - nettoie les ressources FreeRTOS
     */
    ~LoraTwo();

    /*
     * Initialise le module LoRa et démarre les tâches FreeRTOS
     *
     * @param serial    Port série connecté au module LoRa
     *                  - &Serial2 pour ESP32 (GPIO16=RX, GPIO17=TX)
     *                  - Ou HardwareSerial configuré manuellement
     */
    void begin(Stream *serial);

    /*
     * Initialise avec pins personnalisés (ESP32)
     *
     * @param serial    HardwareSerial à utiliser
     * @param rxPin     GPIO pour RX
     * @param txPin     GPIO pour TX
     * @param baud      Baudrate (défaut 9600)
     */
    void begin(HardwareSerial *serial, int rxPin, int txPin, long baud = 9600);

    /*
     * Arrête les tâches FreeRTOS proprement
     */
    void stop();

    /*
     * Envoie un message à un destinataire (thread-safe)
     *
     * @param dst   Adresse du destinataire (0x00 = gateway)
     * @param data  Pointeur vers les données à envoyer
     * @param len   Longueur des données (max 48)
     * @return      true si ajouté à la file d'envoi
     *
     * Exemple:
     *   char msg[] = "Température: 25°C";
     *   net.send(0x00, (uint8_t*)msg, strlen(msg));
     */
    bool send(uint8_t dst, uint8_t *data, uint8_t len);

    /*
     * Envoie un message à tous les appareils (thread-safe)
     *
     * @param data  Pointeur vers les données
     * @param len   Longueur des données
     */
    bool broadcast(uint8_t *data, uint8_t len);

    /*
     * Récupère l'adresse de cet appareil
     */
    uint8_t address();

    /*
     * Vérifie si des tâches tournent
     */
    bool isRunning();

    /*
     * Définit une fonction callback appelée à chaque réception de données
     * NOTE: Le callback est appelé depuis le Core 0!
     *
     * @param callback  Fonction de type void(uint8_t sender, const char* payload, uint8_t len)
     *
     * Exemple:
     *   void onDataReceived(uint8_t sender, const char* payload, uint8_t len) {
     *       Serial.print("De: "); Serial.println(sender);
     *       Serial.print("Data: "); Serial.println(payload);
     *   }
     *   net.setReceiveCallback(onDataReceived);
     */
    void setReceiveCallback(LoraReceiveCallback callback);

    /*
     * Callback étendu avec RSSI et SNR
     */
    void setReceiveCallbackEx(LoraReceiveCallbackEx callback);

    /*
     * Callback pour les événements (ACK, timeout, etc.)
     */
    void setEventCallback(LoraEventCallback callback);

    /*
     * Définit la clé de chiffrement (32 bits) - thread-safe
     * IMPORTANT: Utiliser la MÊME clé sur tous les appareils du réseau!
     *
     * @param key   Clé 32 bits (ex: 0xDEADBEEF)
     *
     * Exemple:
     *   net.setEncryptionKey(0xCAFEBABE);
     */
    void setEncryptionKey(uint32_t key);

    /*
     * Active ou désactive le chiffrement (activé par défaut) - thread-safe
     *
     * @param enabled   true = chiffré, false = non chiffré
     */
    void setEncryptionEnabled(bool enabled);

    /*
     * Vérifie si de nouvelles données sont disponibles (thread-safe)
     */
    bool available();

    /*
     * Récupère l'adresse du dernier émetteur (thread-safe)
     */
    uint8_t getLastSender();

    /*
     * Récupère le payload du dernier message (null-terminated string) - thread-safe
     */
    const char *getLastPayload();

    /*
     * Récupère la longueur du dernier payload (thread-safe)
     */
    uint8_t getLastPayloadLength();

    /*
     * Récupère le RSSI du dernier message
     */
    int getLastRSSI();

    /*
     * Récupère le SNR du dernier message
     */
    int getLastSNR();

    /*
     * Marque les données comme lues (available() retournera false) - thread-safe
     */
    void clearData();

    /*
     * Obtient les statistiques
     */
    uint32_t getPacketsSent();
    uint32_t getPacketsReceived();
    uint32_t getPacketsLost();

    /*
     * Active/désactive les logs série
     */
    void setDebug(bool enabled);

    // ===============================
    // MÉTHODES LEGACY (compatibilité)
    // ===============================

    /*
     * LEGACY: update() n'est plus nécessaire avec ESP32!
     * Conservé pour compatibilité, ne fait rien.
     */
    void update();

    /*
     * LEGACY: receive() - utilisé en interne seulement
     */
    bool receive(LoraTwoPacket &pkt);

private:
    uint8_t _myAddr;
    bool _isGateway;
    volatile uint8_t _seq;
    volatile bool _running;
    bool _debugEnabled;

    // Chiffrement
    uint32_t _encryptionKey;
    volatile bool _encryptionEnabled;

    // Callbacks
    LoraReceiveCallback _receiveCallback;
    LoraReceiveCallbackEx _receiveCallbackEx;
    LoraEventCallback _eventCallback;

    // Stockage des dernières données reçues
    volatile bool _dataAvailable;
    volatile uint8_t _lastSender;
    char _lastPayload[LORATWO_MAX_PAYLOAD + 1];
    volatile uint8_t _lastPayloadLen;
    volatile int _lastRSSI;
    volatile int _lastSNR;

    // Statistiques
    volatile uint32_t _packetsSent;
    volatile uint32_t _packetsReceived;
    volatile uint32_t _packetsLost;

    // Nodes découverts
    LoraTwoNode _nodes[LORATWO_MAX_NODES];
    PendingPacket _pendingPackets[LORATWO_MAX_PENDING];

    // Buffer de réception
    char _recvBuf[512];
    volatile int _recvIdx;
    Stream *_serial;

    // FreeRTOS
    TaskHandle_t _rxTaskHandle;
    TaskHandle_t _txTaskHandle;
    QueueHandle_t _txQueue;
    QueueHandle_t _rxQueue;
    SemaphoreHandle_t _serialMutex;
    SemaphoreHandle_t _dataMutex;
    SemaphoreHandle_t _pendingMutex;

    // Méthodes internes
    void sendPacket(uint8_t dst, LoraTwoPacketType type, uint8_t seq, uint8_t *data, uint8_t len);
    void sendAck(uint8_t dst, uint8_t seq);
    bool parsePacket(char *raw, LoraTwoPacket &pkt);
    void processPacket(LoraTwoPacket &pkt);
    int addPending(uint8_t dst, LoraTwoPacketType type, uint8_t *data, uint8_t len);
    void xorCipher(uint8_t *data, uint8_t len, uint8_t seq);

    // Tâches FreeRTOS (fonctions statiques)
    static void rxTask(void *parameter);
    static void txTask(void *parameter);

    // Log helper
    void debugLog(const char *format, ...);
};

#endif
