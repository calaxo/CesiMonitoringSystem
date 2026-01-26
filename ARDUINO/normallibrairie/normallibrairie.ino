#include <SoftwareSerial.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
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

LoraTwo net(0x02);   // Node à l'adresse 0x02
Adafruit_BME280 bme; // Capteur BME280 en I2C

unsigned long lastSend = 0;
const unsigned long SEND_INTERVAL = 5000; // Envoyer toutes les 30 secondes

void setup()
{
    Serial.begin(9600);
    delay(500);
    Serial.println("=== NODE LoRa 0x02 ===");

    // Initialisation du BME280
    if (!bme.begin(0x76))
    { // Adresse I2C du BME280 (0x76 ou 0x77)
        Serial.println("BME280 non trouvé ! Vérifiez le câblage.");
        while (1)
            ;
    }
    Serial.println("BME280 initialisé");

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

        // Lire la température depuis le BME280
        float temperature = bme.readTemperature();

        // Convertir le float en string (Arduino ne supporte pas %f dans snprintf)
        char tempStr[10];
        dtostrf(temperature, 4, 1, tempStr); // 4 = largeur min, 1 = décimales

        // Formater le message JSON
        char message[50];
        snprintf(message, sizeof(message), "{\"temperature\":%s}", tempStr);

        Serial.print("Envoi: ");
        Serial.println(message);

        net.send(0x00, (uint8_t *)message, strlen(message));
    }

    // update() gère les ACK et les retries automatiquement
    net.update();

    delay(50);
}
