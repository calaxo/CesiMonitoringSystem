#include "LoraTwo.h"
#include <string.h>
#include <stdlib.h>

// Variables pour stocker RSSI/SNR
static int _lastRSSI = 0;
static int _lastSNR = 0;

// ===============================
// CONSTRUCTEUR
// ===============================
LoraTwo::LoraTwo(uint8_t myAddr, bool isGateway)
{
    _myAddr = myAddr;
    _isGateway = isGateway;
    _seq = 0;
    _recvIdx = 0;

    for (int i = 0; i < LORATWO_MAX_NODES; i++)
        _nodes[i].active = false;

    for (int i = 0; i < LORATWO_MAX_PENDING; i++)
        _pendingPackets[i].active = false;
}

// ===============================
// INITIALISATION
// ===============================
void LoraTwo::begin(Stream *serial)
{
    _serial = serial;
    delay(200);

    _serial->print("AT+MODE=TEST\r\n");
    delay(200);

    if (_isGateway)
    {
        _serial->print("AT+TEST=RXLRPKT\r\n");
        Serial.println("[INIT] Gateway prete");
    }
    else
    {
        uint8_t dummy = 0;
        sendPacket(LORATWO_BROADCAST, L2_PKT_DISCOVER, _seq++, &dummy, 0);
        Serial.println("[INIT] Node pret");
    }
}

// ===============================
// INFOS
// ===============================
uint8_t LoraTwo::address() { return _myAddr; }

// ===============================
// ENVOI ASYNCHRONE
// ===============================
bool LoraTwo::send(uint8_t dst, uint8_t *data, uint8_t len)
{
    int idx = addPending(dst, L2_PKT_DATA, data, len);
    return idx != -1;
}

bool LoraTwo::broadcast(uint8_t *data, uint8_t len)
{
    int idx = addPending(LORATWO_BROADCAST, L2_PKT_DATA, data, len);
    return idx != -1;
}

int LoraTwo::addPending(uint8_t dst, LoraTwoPacketType type, uint8_t *data, uint8_t len)
{
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

            sendPacket(dst, type, p.seq, data, len);
            Serial.print("[TX] Envoi vers 0x");
            Serial.print(dst, HEX);
            Serial.print(" : ");
            for (int j = 0; j < len; j++) Serial.print((char)data[j]);
            Serial.println();
            return i;
        }
    }
    return -1;
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

    for (int i = 0; i < len; i++)
        frame[idx++] = data[i];

    sprintf(cmd, "AT+TEST=TXLRPKT,\"");
    for (int i = 0; i < idx; i++)
        sprintf(cmd + strlen(cmd), "%02X", frame[i]);
    strcat(cmd, "\"\r\n");

    _serial->print(cmd);

    delay(300);
    _serial->print("AT+TEST=RXLRPKT\r\n");
}

// ===============================
// ACK
// ===============================
void LoraTwo::sendAck(uint8_t dst, uint8_t seq)
{
    uint8_t dummy = 0;
    delay(700); // Délai pour que le node soit bien en mode RX
    sendPacket(dst, L2_PKT_ACK, seq, &dummy, 0);
}

// ===============================
// RÉCEPTION
// ===============================
bool LoraTwo::receive(LoraTwoPacket &pkt)
{
    while (_serial->available() && _recvIdx < sizeof(_recvBuf) - 1)
    {
        char c = _serial->read();
        _recvBuf[_recvIdx++] = c;
    }
    _recvBuf[_recvIdx] = 0;

    // Extraire RSSI et SNR si présents
    char *rssiPtr = strstr(_recvBuf, "RSSI:");
    char *snrPtr = strstr(_recvBuf, "SNR:");
    if (rssiPtr) _lastRSSI = atoi(rssiPtr + 5);
    if (snrPtr) _lastSNR = atoi(snrPtr + 4);

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
    {
        return false;
    }

    if (!parsePacket(_recvBuf, pkt))
    {
        _recvIdx = 0;
        return false;
    }

    _recvIdx = 0;

    if (pkt.dst == _myAddr || pkt.dst == LORATWO_BROADCAST)
        processPacket(pkt);

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
    if (len < 5)  // Minimum: src, dst, type, seq, len
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
    pkt.len = rawBytes[4];  // Le 5ème byte est la longueur

    // Copier le payload (après les 5 bytes d'header)
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
    // Afficher le message DATA reçu
    if (pkt.type == L2_PKT_DATA && pkt.len > 0)
    {
        Serial.print("[RX] De 0x");
        Serial.print(pkt.src, HEX);
        Serial.print(" (RSSI:");
        Serial.print(_lastRSSI);
        Serial.print(" SNR:");
        Serial.print(_lastSNR);
        Serial.print(") : ");
        for (int i = 0; i < pkt.len; i++)
            Serial.print((char)pkt.payload[i]);
        Serial.println();
    }

    // ACK pour nodes
    if (pkt.type == L2_PKT_DATA && _isGateway)
        sendAck(pkt.src, pkt.seq);

    // Découverte automatique
    if (pkt.type == L2_PKT_DISCOVER && _isGateway)
        sendPacket(pkt.src, L2_PKT_OFFER, _seq++, &_myAddr, 1);
}

// ===============================
// UPDATE ASYNCHRONE
// ===============================
void LoraTwo::update()
{
    unsigned long now = millis();

    for (int i = 0; i < LORATWO_MAX_PENDING; i++)
    {
        PendingPacket &p = _pendingPackets[i];
        if (!p.active)
            continue;

        if (_isGateway && p.type == L2_PKT_DATA)
        {
            p.active = false;
            continue;
        }

        if (now - p.timestamp > LORATWO_ACK_TIMEOUT)
        {
            if (p.retries < LORATWO_MAX_RETRY)
            {
                sendPacket(p.dst, p.type, p.seq, p.payload, p.len);
                p.timestamp = now;
                p.retries++;
                Serial.print("[RETRY] Tentative ");
                Serial.print(p.retries);
                Serial.print("/");
                Serial.println(LORATWO_MAX_RETRY);
            }
            else
            {
                Serial.println("[FAIL] Echec envoi - pas de reponse");
                p.active = false;
            }
        }
    }

    LoraTwoPacket pkt;
    while (receive(pkt))
    {
        if (pkt.type == L2_PKT_ACK)
        {
            for (int i = 0; i < LORATWO_MAX_PENDING; i++)
            {
                if (_pendingPackets[i].active && _pendingPackets[i].seq == pkt.seq)
                {
                    _pendingPackets[i].active = false;
                    Serial.print("[OK] ACK recu de 0x");
                    Serial.print(pkt.src, HEX);
                    Serial.print(" (RSSI:");
                    Serial.print(_lastRSSI);
                    Serial.print(" SNR:");
                    Serial.print(_lastSNR);
                    Serial.println(")");
                }
            }
        }
    }
}
