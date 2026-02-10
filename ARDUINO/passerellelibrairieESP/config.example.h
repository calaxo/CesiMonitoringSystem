/*
 * ===============================
 * CONFIGURATION - NE PAS COMMIT SUR GITHUB
 * ===============================
 *
 * Copiez config.example.h vers config.h et remplissez vos credentials.
 * Le fichier config.h est ignoré par git (voir .gitignore)
 */

#ifndef CONFIG_H
#define CONFIG_H

// ===============================
// CONFIGURATION WIFI
// ===============================
#define WIFI_SSID "CESI_Iot"
#define WIFI_PASSWORD "#RO_i0t.n3t"

// ===============================
// CONFIGURATION RÉSEAU (IP FIXE)
// ===============================
#define IP_ADDRESS 192, 168, 1, 20
#define GATEWAY 192, 168, 1, 1 // Pas utilisé mais requis
#define SUBNET 255, 255, 255, 0
#define DNS 8, 8, 8, 8 // Pas utilisé mais requis

// ===============================
// CONFIGURATION MQTT
// ===============================
#define MQTT_SERVER "192.168.1.10"
#define MQTT_PORT 1883
#define MQTT_CLIENT "LoraGateway"
#define MQTT_TOPIC "sensors"

#endif
