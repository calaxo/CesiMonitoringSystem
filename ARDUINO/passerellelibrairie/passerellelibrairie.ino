#include <WiFiS3.h>
#include <PubSubClient.h>
#include <SoftwareSerial.h>
#include "LoraTwo.h"
#include "config.h" // Credentials WiFi/MQTT (non commité sur GitHub)

// ===============================
// CONFIGURATION GATEWAY (Passerelle)
// ===============================
//
// La GATEWAY est le point central du réseau LoRa.
// Elle reçoit les messages de tous les nodes, ajoute l'ID de l'émetteur,
// et transmet le tout au broker MQTT.
//
// ===============================

LoraTwo net(0x00, true); // Adresse 0x00, mode Gateway activé

// ===============================
// WIFI & MQTT
// ===============================
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// Buffer pour construire le message JSON complet
char mqttBuffer[128];

// ===============================
// CALLBACK RÉCEPTION LORA
// ===============================
void onLoraReceive(uint8_t sender, const char *payload, uint8_t len)
{
    Serial.print("[LORA] Reçu de 0x");
    Serial.print(sender, HEX);
    Serial.print(": ");
    Serial.println(payload);

    // Construire le JSON avec sensor_id ajouté
    // Le payload reçu est du type: {"temperature":25.9}
    // On veut: {"sensor_id":"02","temperature":25.9}

    // Convertir l'adresse en string (format hex à 2 chiffres)
    char sensorId[5];
    snprintf(sensorId, sizeof(sensorId), "%02X", sender);

    // Vérifier si le payload commence par {
    if (payload[0] == '{')
    {
        // Insérer sensor_id au début du JSON
        snprintf(mqttBuffer, sizeof(mqttBuffer), "{\"sensor_id\":\"%s\",%s",
                 sensorId, payload + 1); // +1 pour sauter le { initial
    }
    else
    {
        // Payload non-JSON, encapsuler
        snprintf(mqttBuffer, sizeof(mqttBuffer), "{\"sensor_id\":\"%s\",\"data\":\"%s\"}",
                 sensorId, payload);
    }

    // Publier sur MQTT
    if (mqttClient.connected())
    {
        if (mqttClient.publish(MQTT_TOPIC, mqttBuffer))
        {
            Serial.print("[MQTT] Publié: ");
            Serial.println(mqttBuffer);
        }
        else
        {
            Serial.println("[MQTT] Erreur publication!");
        }
    }
    else
    {
        Serial.println("[MQTT] Non connecté, message perdu");
    }
}

// ===============================
// CONNEXION WIFI
// ===============================
void wifiConnect()
{
    if (WiFi.status() == WL_NO_MODULE)
    {
        Serial.println("Module WiFi non trouvé!");
        while (true)
            ;
    }

    // Configuration IP statique (commenter pour DHCP)
    IPAddress ip(IP_ADDRESS);
    IPAddress gateway(GATEWAY);
    IPAddress subnet(SUBNET);
    IPAddress dns(DNS);
    WiFi.config(ip, dns, gateway, subnet); // Ordre corrigé: ip, dns, gateway, subnet

    Serial.print("Connexion à ");
    Serial.print(WIFI_SSID);

    while (WiFi.status() != WL_CONNECTED)
    {
        Serial.print(".");
        WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
        delay(5000);
    }

    Serial.println(" OK!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());

    // Attendre que le stack TCP/IP soit prêt
    delay(2000);
}

// ===============================
// CONNEXION MQTT
// ===============================
void mqttConnect()
{
    mqttClient.setServer(MQTT_SERVER, MQTT_PORT);

    while (!mqttClient.connected())
    {
        Serial.print("Connexion MQTT...");
        Serial.print(MQTT_SERVER);
        Serial.print(MQTT_PORT);
        if (mqttClient.connect(MQTT_CLIENT))
        {
            Serial.println(" OK!");
        }
        else
        {
            Serial.print(" Erreur (rc=");
            Serial.print(mqttClient.state());
            Serial.println("), retry dans 5s");
            delay(5000);
        }
    }
}

// ===============================
// SETUP
// ===============================

SoftwareSerial loraSerial(2, 3); // RX=2, TX=3

void setup()
{
    Serial.begin(9600);
    delay(500);
    Serial.println("=== GATEWAY LoRa + MQTT ===");

    // Connexion WiFi
    wifiConnect();

    // Connexion MQTT
    mqttConnect();

    // Pour Arduino UNO : utiliser SoftwareSerial
    // SoftwareSerial loraSerial(2, 3); // RX=2, TX=3
    loraSerial.begin(9600);
    net.setEncryptionKey(0xCAFEBABE);
    // net.setEncryptionEnabled(false);
    net.begin(&loraSerial);

    // Pour Arduino Mega : utiliser Serial1 (pins 18/19)
    // Serial1.begin(9600);
    // net.begin(&Serial1);

    // Définir le callback pour la réception LoRa
    net.setReceiveCallback(onLoraReceive);

    Serial.println("Gateway prête!");
}

// ===============================
// LOOP
// ===============================
void loop()
{
    // Maintenir la connexion MQTT
    if (!mqttClient.connected())
    {
        mqttConnect();
    }
    mqttClient.loop();

    // Traiter les messages LoRa
    net.update();

    delay(50);
}
