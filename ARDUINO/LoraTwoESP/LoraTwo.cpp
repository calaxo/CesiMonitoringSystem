/*
 * ===============================
 * LoraTwo - Implémentation ESP32 avec FreeRTOS
 * ===============================
 * 
 * Architecture multithread:
 *   - Core 0: Tâche RX (réception LoRa haute priorité)
 *   - Core 1: Tâche TX (envoi, retries, traitement)
 * 
 * Communication inter-tâches via queues FreeRTOS
 * Protection des ressources partagées via mutex
 */

#include "LoraTwo.h"
#include <string.h>
#include <stdlib.h>
#include <stdarg.h>

// ===============================
// CONSTRUCTEUR
// ===============================
LoraTwo::LoraTwo(uint8_t myAddr, bool isGateway)
{
    _myAddr = myAddr;
    _isGateway = isGateway;
    _seq = 0;
    _recvIdx = 0;
    _running = false;
    _debugEnabled = true;

    // Chiffrement activé par défaut
    _encryptionKey = LORATWO_DEFAULT_KEY;
    _encryptionEnabled = true;

    // Initialiser callbacks
    _receiveCallback = NULL;
    _receiveCallbackEx = NULL;
    _eventCallback = NULL;
    
    // Stockage données
    _dataAvailable = false;
    _lastSender = 0;
    _lastPayloadLen = 0;
    _lastRSSI = 0;
    _lastSNR = 0;
    memset(_lastPayload, 0, sizeof(_lastPayload));

    // Statistiques
    _packetsSent = 0;
    _packetsReceived = 0;
    _packetsLost = 0;

    // FreeRTOS handles initialisés à NULL
    _rxTaskHandle = NULL;
    _txTaskHandle = NULL;
    _txQueue = NULL;
    _rxQueue = NULL;
    _serialMutex = NULL;
    _dataMutex = NULL;
    _pendingMutex = NULL;

    for (int i = 0; i < LORATWO_MAX_NODES; i++)
    {
        _nodes[i].active = false;
        _nodes[i].lastSeen = 0;
        _nodes[i].lastRssi = 0;
    }

    for (int i = 0; i < LORATWO_MAX_PENDING; i++)
        _pendingPackets[i].active = false;
}

// ===============================
// DESTRUCTEUR
// ===============================
LoraTwo::~LoraTwo()
{
    stop();
}

// ===============================
// ARRÊT PROPRE
// ===============================
void LoraTwo::stop()
{
    _running = false;
    
    // Attendre que les tâches se terminent
    vTaskDelay(pdMS_TO_TICKS(100));
    
    // Supprimer les tâches
    if (_rxTaskHandle != NULL)
    {
        vTaskDelete(_rxTaskHandle);
        _rxTaskHandle = NULL;
    }
    if (_txTaskHandle != NULL)
    {
        vTaskDelete(_txTaskHandle);
        _txTaskHandle = NULL;
    }
    
    // Supprimer les queues
    if (_txQueue != NULL)
    {
        vQueueDelete(_txQueue);
        _txQueue = NULL;
    }
    if (_rxQueue != NULL)
    {
        vQueueDelete(_rxQueue);
        _rxQueue = NULL;
    }
    
    // Supprimer les mutex
    if (_serialMutex != NULL)
    {
        vSemaphoreDelete(_serialMutex);
        _serialMutex = NULL;
    }
    if (_dataMutex != NULL)
    {
        vSemaphoreDelete(_dataMutex);
        _dataMutex = NULL;
    }
    if (_pendingMutex != NULL)
    {
        vSemaphoreDelete(_pendingMutex);
        _pendingMutex = NULL;
    }
}

// ===============================
// INITIALISATION
// ===============================
void LoraTwo::begin(Stream *serial)
{
    _serial = serial;
    
    // Créer les mutex
    _serialMutex = xSemaphoreCreateMutex();
    _dataMutex = xSemaphoreCreateMutex();
    _pendingMutex = xSemaphoreCreateMutex();
    
    // Créer les queues
    _txQueue = xQueueCreate(LORATWO_TX_QUEUE_SIZE, sizeof(TxMessage));
    _rxQueue = xQueueCreate(LORATWO_RX_QUEUE_SIZE, sizeof(LoraTwoPacket));
    
    // Configuration du module LoRa
    vTaskDelay(pdMS_TO_TICKS(200));
    
    if (xSemaphoreTake(_serialMutex, portMAX_DELAY) == pdTRUE)
    {
        _serial->print("AT+MODE=TEST\r\n");
        vTaskDelay(pdMS_TO_TICKS(200));
        _serial->print("AT+TEST=RXLRPKT\r\n");
        xSemaphoreGive(_serialMutex);
    }
    
    _running = true;
    
    // Créer la tâche de réception sur Core 0 (haute priorité)
    xTaskCreatePinnedToCore(
        rxTask,                     // Fonction
        "LoRa_RX",                  // Nom
        LORATWO_TASK_STACK_SIZE,    // Stack
        this,                       // Paramètre (pointeur vers l'instance)
        LORATWO_TASK_PRIORITY_RX,   // Priorité
        &_rxTaskHandle,             // Handle
        LORATWO_CORE_RX             // Core 0
    );
    
    // Créer la tâche d'envoi/traitement sur Core 1
    xTaskCreatePinnedToCore(
        txTask,
        "LoRa_TX",
        LORATWO_TASK_STACK_SIZE,
        this,
        LORATWO_TASK_PRIORITY_TX,
        &_txTaskHandle,
        LORATWO_CORE_TX
    );
    
    if (_isGateway)
    {
        debugLog("[INIT] Gateway ESP32 prête (dual-core)");
    }
    else
    {
        // Découverte réseau
        uint8_t dummy = 0;
        sendPacket(LORATWO_BROADCAST, L2_PKT_DISCOVER, _seq++, &dummy, 0);
        debugLog("[INIT] Node ESP32 0x%02X pret (dual-core)", _myAddr);
    }
}

// Initialisation avec pins personnalisés
void LoraTwo::begin(HardwareSerial *serial, int rxPin, int txPin, long baud)
{
    serial->begin(baud, SERIAL_8N1, rxPin, txPin);
    vTaskDelay(pdMS_TO_TICKS(100));
    begin((Stream *)serial);
}

// ===============================
// LOG HELPER
// ===============================
void LoraTwo::debugLog(const char *format, ...)
{
    if (!_debugEnabled)
        return;
        
    char buffer[128];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    Serial.println(buffer);
}

// ===============================
// INFOS & ÉTAT
// ===============================
uint8_t LoraTwo::address() { return _myAddr; }
bool LoraTwo::isRunning() { return _running; }

// ===============================
// STATISTIQUES
// ===============================
uint32_t LoraTwo::getPacketsSent() { return _packetsSent; }
uint32_t LoraTwo::getPacketsReceived() { return _packetsReceived; }
uint32_t LoraTwo::getPacketsLost() { return _packetsLost; }
void LoraTwo::setDebug(bool enabled) { _debugEnabled = enabled; }

// ===============================
// CALLBACKS
// ===============================
void LoraTwo::setReceiveCallback(LoraReceiveCallback callback)
{
    _receiveCallback = callback;
}

void LoraTwo::setReceiveCallbackEx(LoraReceiveCallbackEx callback)
{
    _receiveCallbackEx = callback;
}

void LoraTwo::setEventCallback(LoraEventCallback callback)
{
    _eventCallback = callback;
}

// ===============================
// DONNÉES REÇUES (THREAD-SAFE)
// ===============================
bool LoraTwo::available()
{
    bool result = false;
    if (xSemaphoreTake(_dataMutex, pdMS_TO_TICKS(10)) == pdTRUE)
    {
        result = _dataAvailable;
        xSemaphoreGive(_dataMutex);
    }
    return result;
}

uint8_t LoraTwo::getLastSender()
{
    uint8_t result = 0;
    if (xSemaphoreTake(_dataMutex, pdMS_TO_TICKS(10)) == pdTRUE)
    {
        result = _lastSender;
        xSemaphoreGive(_dataMutex);
    }
    return result;
}

const char *LoraTwo::getLastPayload()
{
    return _lastPayload; // Lecture atomique string, ok sans mutex
}

uint8_t LoraTwo::getLastPayloadLength()
{
    return _lastPayloadLen;
}

int LoraTwo::getLastRSSI()
{
    return _lastRSSI;
}

int LoraTwo::getLastSNR()
{
    return _lastSNR;
}

void LoraTwo::clearData()
{
    if (xSemaphoreTake(_dataMutex, pdMS_TO_TICKS(10)) == pdTRUE)
    {
        _dataAvailable = false;
        xSemaphoreGive(_dataMutex);
    }
}

// ===============================
// CHIFFREMENT
// ===============================
void LoraTwo::setEncryptionKey(uint32_t key)
{
    _encryptionKey = key;
}

void LoraTwo::setEncryptionEnabled(bool enabled)
{
    _encryptionEnabled = enabled;
}

// Chiffrement XOR rapide avec PRNG
void LoraTwo::xorCipher(uint8_t *data, uint8_t len, uint8_t seq)
{
    if (!_encryptionEnabled)
        return;

    uint32_t seed = _encryptionKey ^ ((uint32_t)seq * 0x9E3779B9);

    for (uint8_t i = 0; i < len; i++)
    {
        seed = seed * 1103515245 + 12345;
        uint8_t keystreamByte = (seed >> 16) & 0xFF;
        data[i] ^= keystreamByte;
    }
}

// ===============================
// ENVOI (THREAD-SAFE)
// ===============================
bool LoraTwo::send(uint8_t dst, uint8_t *data, uint8_t len)
{
    return addPending(dst, L2_PKT_DATA, data, len) != -1;
}

bool LoraTwo::broadcast(uint8_t *data, uint8_t len)
{
    return addPending(LORATWO_BROADCAST, L2_PKT_DATA, data, len) != -1;
}

int LoraTwo::addPending(uint8_t dst, LoraTwoPacketType type, uint8_t *data, uint8_t len)
{
    if (xSemaphoreTake(_pendingMutex, pdMS_TO_TICKS(100)) != pdTRUE)
        return -1;
        
    int result = -1;
    for (int i = 0; i < LORATWO_MAX_PENDING; i++)
    {
        if (!_pendingPackets[i].active)
        {
            PendingPacket &p = _pendingPackets[i];
            p.dst = dst;
            p.type = type;
            p.seq = _seq++;
            p.len = len;
            memcpy(p.payload, data, len);
            p.timestamp = millis();
            p.retries = 0;
            p.active = true;

            // Envoyer via la queue TX
            TxMessage msg;
            msg.dst = dst;
            msg.type = type;
            msg.seq = p.seq;
            msg.len = len;
            memcpy(msg.payload, data, len);
            msg.needsAck = !_isGateway && (dst != LORATWO_BROADCAST);
            
            xQueueSend(_txQueue, &msg, pdMS_TO_TICKS(100));
            
            debugLog("[TX] Envoi vers 0x%02X seq=%d", dst, p.seq);
            result = i;
            break;
        }
    }
    
    xSemaphoreGive(_pendingMutex);
    return result;
}

// ===============================
// ENVOI BRUT
// ===============================
void LoraTwo::sendPacket(uint8_t dst, LoraTwoPacketType type, uint8_t seq, uint8_t *data, uint8_t len)
{
    uint8_t frame[64];
    char cmd[256];
    int idx = 0;

    frame[idx++] = _myAddr;
    frame[idx++] = dst;
    frame[idx++] = type;
    frame[idx++] = seq;
    frame[idx++] = len;

    if (len > 0 && type == L2_PKT_DATA)
    {
        memcpy(&frame[idx], data, len);
        xorCipher(&frame[idx], len, seq);
        idx += len;
    }
    else
    {
        for (int i = 0; i < len; i++)
            frame[idx++] = data[i];
    }

    snprintf(cmd, sizeof(cmd), "AT+TEST=TXLRPKT,\"");
    for (int i = 0; i < idx; i++)
        snprintf(cmd + strlen(cmd), sizeof(cmd) - strlen(cmd), "%02X", frame[i]);
    strncat(cmd, "\"\r\n", sizeof(cmd) - strlen(cmd) - 1);

    if (xSemaphoreTake(_serialMutex, pdMS_TO_TICKS(500)) == pdTRUE)
    {
        _serial->print(cmd);
        vTaskDelay(pdMS_TO_TICKS(300));
        _serial->print("AT+TEST=RXLRPKT\r\n");
        xSemaphoreGive(_serialMutex);
        _packetsSent++;
    }
}

// ===============================
// ACK
// ===============================
void LoraTwo::sendAck(uint8_t dst, uint8_t seq)
{
    uint8_t dummy = 0;
    vTaskDelay(pdMS_TO_TICKS(700));
    sendPacket(dst, L2_PKT_ACK, seq, &dummy, 0);
}

// ===============================
// RÉCEPTION
// ===============================
bool LoraTwo::receive(LoraTwoPacket &pkt)
{
    if (xSemaphoreTake(_serialMutex, pdMS_TO_TICKS(10)) != pdTRUE)
        return false;
        
    while (_serial->available() && _recvIdx < (int)(sizeof(_recvBuf) - 1))
    {
        char c = _serial->read();
        _recvBuf[_recvIdx++] = c;
    }
    _recvBuf[_recvIdx] = 0;
    
    xSemaphoreGive(_serialMutex);

    // Extraire RSSI et SNR
    char *rssiPtr = strstr(_recvBuf, "RSSI:");
    char *snrPtr = strstr(_recvBuf, "SNR:");
    if (rssiPtr)
        pkt.rssi = atoi(rssiPtr + 5);
    if (snrPtr)
        pkt.snr = atoi(snrPtr + 4);

    char *rxStart = strstr(_recvBuf, "+TEST: RX \"");
    if (!rxStart)
    {
        if (_recvIdx > 400 || (strstr(_recvBuf, "RXLRPKT") && !strstr(_recvBuf, "+TEST: RX")))
        {
            _recvIdx = 0;
        }
        return false;
    }

    char *rxEnd = strchr(rxStart + 11, '\"');
    if (!rxEnd)
        return false;

    if (!parsePacket(_recvBuf, pkt))
    {
        _recvIdx = 0;
        return false;
    }

    _recvIdx = 0;
    return true;
}

// ===============================
// PARSING AT
// ===============================
bool LoraTwo::parsePacket(char *raw, LoraTwoPacket &pkt)
{
    char *p = strstr(raw, "+TEST: RX \"");
    if (!p)
        return false;

    p += 11;
    char *end = strchr(p, '"');
    if (!end)
        return false;

    int len = (end - p) / 2;
    if (len < 5)
        return false;

    uint8_t rawBytes[64];
    for (int i = 0; i < len; i++)
    {
        char byteStr[3] = {p[i * 2], p[i * 2 + 1], 0};
        rawBytes[i] = strtoul(byteStr, NULL, 16);
    }

    pkt.src = rawBytes[0];
    pkt.dst = rawBytes[1];
    pkt.type = rawBytes[2];
    pkt.seq = rawBytes[3];
    pkt.len = rawBytes[4];

    if (len > 5 && pkt.len > 0)
    {
        for (int i = 0; i < pkt.len && i < LORATWO_MAX_PAYLOAD; i++)
            pkt.payload[i] = rawBytes[5 + i];
    }

    return true;
}

// ===============================
// TRAITEMENT LOGIQUE
// ===============================
void LoraTwo::processPacket(LoraTwoPacket &pkt)
{
    if (pkt.type == L2_PKT_DATA && pkt.len > 0)
    {
        // Déchiffrer
        xorCipher(pkt.payload, pkt.len, pkt.seq);

        // Stocker (thread-safe)
        if (xSemaphoreTake(_dataMutex, pdMS_TO_TICKS(50)) == pdTRUE)
        {
            _lastSender = pkt.src;
            _lastPayloadLen = pkt.len;
            memcpy(_lastPayload, pkt.payload, pkt.len);
            _lastPayload[pkt.len] = '\0';
            _lastRSSI = pkt.rssi;
            _lastSNR = pkt.snr;
            _dataAvailable = true;
            _packetsReceived++;
            xSemaphoreGive(_dataMutex);
        }

        // Callbacks
        if (_receiveCallback != NULL)
        {
            _receiveCallback(_lastSender, _lastPayload, _lastPayloadLen);
        }
        if (_receiveCallbackEx != NULL)
        {
            _receiveCallbackEx(_lastSender, _lastPayload, _lastPayloadLen, pkt.rssi, pkt.snr);
        }

        debugLog("[RX] De 0x%02X (RSSI:%d SNR:%d): %s", pkt.src, pkt.rssi, pkt.snr, _lastPayload);
    }

    // ACK pour nodes
    if (pkt.type == L2_PKT_DATA && _isGateway)
    {
        sendAck(pkt.src, pkt.seq);
    }

    // Découverte automatique
    if (pkt.type == L2_PKT_DISCOVER && _isGateway)
    {
        sendPacket(pkt.src, L2_PKT_OFFER, _seq++, &_myAddr, 1);
        
        // Enregistrer le node
        for (int i = 0; i < LORATWO_MAX_NODES; i++)
        {
            if (!_nodes[i].active || _nodes[i].addr == pkt.src)
            {
                _nodes[i].addr = pkt.src;
                _nodes[i].active = true;
                _nodes[i].lastSeen = millis();
                _nodes[i].lastRssi = pkt.rssi;
                
                if (_eventCallback)
                    _eventCallback(LORA_EVENT_NODE_DISCOVERED, pkt.src, pkt.seq);
                break;
            }
        }
    }
}

// ===============================
// TÂCHE RX (Core 0)
// ===============================
void LoraTwo::rxTask(void *parameter)
{
    LoraTwo *self = (LoraTwo *)parameter;
    LoraTwoPacket pkt;
    
    while (self->_running)
    {
        if (self->receive(pkt))
        {
            if (pkt.dst == self->_myAddr || pkt.dst == LORATWO_BROADCAST)
            {
                // Traitement ACK immédiat
                if (pkt.type == L2_PKT_ACK)
                {
                    if (xSemaphoreTake(self->_pendingMutex, pdMS_TO_TICKS(50)) == pdTRUE)
                    {
                        for (int i = 0; i < LORATWO_MAX_PENDING; i++)
                        {
                            if (self->_pendingPackets[i].active && 
                                self->_pendingPackets[i].seq == pkt.seq)
                            {
                                self->_pendingPackets[i].active = false;
                                self->debugLog("[OK] ACK recu de 0x%02X seq=%d", pkt.src, pkt.seq);
                                
                                if (self->_eventCallback)
                                    self->_eventCallback(LORA_EVENT_ACK_RECEIVED, pkt.src, pkt.seq);
                            }
                        }
                        xSemaphoreGive(self->_pendingMutex);
                    }
                }
                else
                {
                    // Envoyer à la queue pour traitement
                    xQueueSend(self->_rxQueue, &pkt, pdMS_TO_TICKS(10));
                }
            }
        }
        
        vTaskDelay(pdMS_TO_TICKS(10)); // Yield pour éviter watchdog
    }
    
    vTaskDelete(NULL);
}

// ===============================
// TÂCHE TX (Core 1)
// ===============================
void LoraTwo::txTask(void *parameter)
{
    LoraTwo *self = (LoraTwo *)parameter;
    TxMessage txMsg;
    LoraTwoPacket rxPkt;
    
    while (self->_running)
    {
        // Traiter les messages à envoyer
        if (xQueueReceive(self->_txQueue, &txMsg, pdMS_TO_TICKS(10)) == pdTRUE)
        {
            self->sendPacket(txMsg.dst, (LoraTwoPacketType)txMsg.type, txMsg.seq, 
                           txMsg.payload, txMsg.len);
        }
        
        // Traiter les paquets reçus
        if (xQueueReceive(self->_rxQueue, &rxPkt, pdMS_TO_TICKS(10)) == pdTRUE)
        {
            self->processPacket(rxPkt);
        }
        
        // Vérifier les timeouts et retries
        unsigned long now = millis();
        
        if (xSemaphoreTake(self->_pendingMutex, pdMS_TO_TICKS(50)) == pdTRUE)
        {
            for (int i = 0; i < LORATWO_MAX_PENDING; i++)
            {
                PendingPacket &p = self->_pendingPackets[i];
                if (!p.active)
                    continue;

                // Gateway n'attend pas d'ACK pour DATA
                if (self->_isGateway && p.type == L2_PKT_DATA)
                {
                    p.active = false;
                    if (self->_eventCallback)
                        self->_eventCallback(LORA_EVENT_SEND_OK, p.dst, p.seq);
                    continue;
                }

                // Broadcast n'attend pas d'ACK
                if (p.dst == LORATWO_BROADCAST)
                {
                    p.active = false;
                    continue;
                }

                if (now - p.timestamp > LORATWO_ACK_TIMEOUT)
                {
                    if (p.retries < LORATWO_MAX_RETRY)
                    {
                        self->sendPacket(p.dst, p.type, p.seq, p.payload, p.len);
                        p.timestamp = now;
                        p.retries++;
                        self->debugLog("[RETRY] seq=%d tentative %d/%d", p.seq, p.retries, LORATWO_MAX_RETRY);
                    }
                    else
                    {
                        self->debugLog("[FAIL] seq=%d echec envoi - pas de reponse", p.seq);
                        p.active = false;
                        self->_packetsLost++;
                        
                        if (self->_eventCallback)
                            self->_eventCallback(LORA_EVENT_SEND_FAILED, p.dst, p.seq);
                    }
                }
            }
            xSemaphoreGive(self->_pendingMutex);
        }
        
        vTaskDelay(pdMS_TO_TICKS(50));
    }
    
    vTaskDelete(NULL);
}

// ===============================
// LEGACY: UPDATE (NE FAIT RIEN)
// ===============================
void LoraTwo::update()
{
    // Sur ESP32, tout est géré par les tâches FreeRTOS
    // Cette fonction existe pour la compatibilité avec l'ancien code
}
