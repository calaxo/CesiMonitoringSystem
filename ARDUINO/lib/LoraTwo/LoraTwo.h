/*
 * ===============================
 * LoraTwo - Librairie LoRa simple pour Arduino
 * ===============================
 *
 * Cette librairie permet de créer un réseau LoRa simple avec:
 *   - Une GATEWAY (passerelle) qui reçoit les messages
 *   - Plusieurs NODES (capteurs) qui envoient des données
 *
 * FONCTIONNALITÉS:
 *   - Envoi de messages avec accusé de réception (ACK)
 *   - Retries automatiques si pas de réponse
 *   - Découverte automatique des nodes
 *   - Broadcast vers tous les appareils
 *   - CHIFFREMENT XOR des trames (rapide et léger)
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
 *   // Initialiser
 *   net.begin(&Serial1);
 *
 *   // Envoyer un message (sera chiffré automatiquement)
 *   char msg[] = "Hello!";
 *   net.send(0x00, (uint8_t*)msg, strlen(msg));
 *
 *   // Dans loop(), toujours appeler:
 *   net.update();
 *
 * ===============================
 */

#ifndef LORATWO_H
#define LORATWO_H

#include <Arduino.h>
#include <Stream.h>

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
#define LORATWO_MAX_PENDING 8  // Nombre max de messages en attente d'ACK

#define LORATWO_ACK_TIMEOUT 4000 // Délai avant retry (ms)
#define LORATWO_MAX_RETRY 3      // Nombre de tentatives max

// ===============================
// CALLBACK POUR RÉCEPTION
// ===============================

// Type de fonction callback appelée à chaque message reçu
// Paramètres: senderAddress, payload (string), length
typedef void (*LoraReceiveCallback)(uint8_t sender, const char *payload, uint8_t len);

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
};

// ===============================
// STRUCTURE NODE
// ===============================

struct LoraTwoNode
{
    uint8_t addr; // Adresse du node
    bool active;  // Node actif?
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
     * Initialise le module LoRa
     *
     * @param serial    Port série connecté au module LoRa
     *                  - &Serial1 pour Mega (pins 18/19)
     *                  - &loraSerial pour SoftwareSerial
     */
    void begin(Stream *serial);

    /*
     * À appeler dans loop() - gère tout automatiquement:
     *   - Réception des messages
     *   - Envoi des ACK (gateway)
     *   - Retries si pas de réponse (node)
     */
    void update();

    /*
     * Envoie un message à un destinataire
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
     * Envoie un message à tous les appareils
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
     * Reçoit un paquet (utilisé en interne par update())
     */
    bool receive(LoraTwoPacket &pkt);

    /*
     * Définit une fonction callback appelée à chaque réception de données
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
     * Définit la clé de chiffrement (32 bits)
     * IMPORTANT: Utiliser la MÊME clé sur tous les appareils du réseau!
     *
     * @param key   Clé 32 bits (ex: 0xDEADBEEF)
     *
     * Exemple:
     *   net.setEncryptionKey(0xCAFEBABE);
     */
    void setEncryptionKey(uint32_t key);

    /*
     * Active ou désactive le chiffrement (activé par défaut)
     *
     * @param enabled   true = chiffré, false = non chiffré
     */
    void setEncryptionEnabled(bool enabled);

    /*
     * Vérifie si de nouvelles données sont disponibles
     */
    bool available();

    /*
     * Récupère l'adresse du dernier émetteur
     */
    uint8_t getLastSender();

    /*
     * Récupère le payload du dernier message (null-terminated string)
     */
    const char *getLastPayload();

    /*
     * Récupère la longueur du dernier payload
     */
    uint8_t getLastPayloadLength();

    /*
     * Marque les données comme lues (available() retournera false)
     */
    void clearData();

private:
    uint8_t _myAddr;
    bool _isGateway;
    uint8_t _seq;

    // Chiffrement
    uint32_t _encryptionKey;
    bool _encryptionEnabled;

    // Callback pour réception
    LoraReceiveCallback _receiveCallback;

    // Stockage des dernières données reçues
    bool _dataAvailable;
    uint8_t _lastSender;
    char _lastPayload[LORATWO_MAX_PAYLOAD + 1]; // +1 pour null terminator
    uint8_t _lastPayloadLen;

    LoraTwoNode _nodes[LORATWO_MAX_NODES];
    PendingPacket _pendingPackets[LORATWO_MAX_PENDING];

    char _recvBuf[512];
    int _recvIdx;
    Stream *_serial;

    void sendPacket(uint8_t dst, LoraTwoPacketType type, uint8_t seq, uint8_t *data, uint8_t len);
    void sendAck(uint8_t dst, uint8_t seq);

    bool parsePacket(char *raw, LoraTwoPacket &pkt);
    void processPacket(LoraTwoPacket &pkt);
    int addPending(uint8_t dst, LoraTwoPacketType type, uint8_t *data, uint8_t len);

    // Chiffrement XOR rapide
    void xorCipher(uint8_t *data, uint8_t len, uint8_t seq);
};

#endif
