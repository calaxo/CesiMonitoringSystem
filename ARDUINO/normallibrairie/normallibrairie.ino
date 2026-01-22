#include <SoftwareSerial.h>
#include "LoraTwo.h"

// ===============================
// CONFIGURATION NODE (Capteur/Client)
// ===============================
//
// Un NODE est un appareil qui envoie des données à la gateway.
// Chaque node doit avoir une ADRESSE UNIQUE sur le réseau.
//
// PARAMÈTRES:
//   - Premier paramètre : adresse du node (0x01 à 0xFE)
//   - Pas de deuxième paramètre = c'est un node (pas une gateway)
//
// EXEMPLES:
//   LoraTwo net(0x01);  // Node capteur température
//   LoraTwo net(0x02);  // Node capteur humidité  
//   LoraTwo net(0x03);  // Node bouton
//   LoraTwo net(0x10);  // Node #16
//
// ADRESSES RÉSERVÉES:
//   0x00 = Gateway
//   0xFF = Broadcast (tous les appareils)
//
// ===============================

LoraTwo net(0x02);  // Node à l'adresse 0x02

unsigned long lastSend = 0;
const unsigned long SEND_INTERVAL = 5000;  // Envoyer toutes les 5 secondes

void setup()
{
    Serial.begin(9600);
    delay(500);
    Serial.println("=== NODE LoRa 0x02 ===");

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
    unsigned long now = millis();

    // Envoi périodique vers la gateway (adresse 0x00)
    if (now - lastSend >= SEND_INTERVAL)
    {
        lastSend = now;
        
        // Tu peux envoyer n'importe quel texte (max 48 caractères)
        char message[] = "Bonjour depuis le node 2!";
        net.send(0x00, (uint8_t*)message, strlen(message));
    }

    // update() gère les ACK et les retries automatiquement
    net.update();
    
    delay(50);
}
