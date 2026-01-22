#include <SoftwareSerial.h>
#include "LoraTwo.h"

// ===============================
// CONFIGURATION GATEWAY (Passerelle)
// ===============================
//
// La GATEWAY est le point central du réseau LoRa.
// Elle reçoit les messages de tous les nodes et envoie les ACK.
//
// PARAMÈTRES:
//   - Premier paramètre : adresse de la gateway (0x00 recommandé)
//   - Deuxième paramètre : true = c'est une gateway
//
// EXEMPLE:
//   LoraTwo net(0x00, true);  // Gateway à l'adresse 0x00
//
// ===============================

LoraTwo net(0x00, true);  // Adresse 0x00, mode Gateway activé

void setup()
{
    Serial.begin(9600);
    delay(500);
    Serial.println("=== GATEWAY LoRa ===");

    // Pour Arduino UNO : utiliser SoftwareSerial
    // SoftwareSerial loraSerial(2, 3); // RX=2, TX=3
    // loraSerial.begin(9600);
    // net.begin(&loraSerial);

    // Pour Arduino Mega : utiliser Serial1 (pins 18/19)
    Serial1.begin(9600);
    net.begin(&Serial1);
}

void loop()
{
    // update() fait tout : réception des messages + envoi des ACK
    net.update();
    
    delay(50);
}
