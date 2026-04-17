#!/bin/bash
# Commandes mosquitto_pub pour tester MQTT manuellement (sans HMAC)
# Le backend accepte les messages sans hmac field.
#
# Prérequis: mosquitto-clients installé
#   Ubuntu/Debian: apt install mosquitto-clients
#   Windows: winget install EclipseFoundation.Mosquitto
#
# Usage: bash test_mqtt_manual.sh

BROKER="localhost"
PORT="1883"

echo "Publication de messages de test sur $BROKER:$PORT..."

# Capteur 1 - Normal, pas de présence
mosquitto_pub -h $BROKER -p $PORT \
  -t "sensors/1" \
  -m '{"sensor_id":"sensor_001","t":21.5,"m":false,"rssi":-65,"snr":9.5}'
echo "✓ sensors/1 - T:21.5°C M:NON"

# Capteur 2 - Présence détectée
mosquitto_pub -h $BROKER -p $PORT \
  -t "sensors/2" \
  -m '{"sensor_id":"sensor_002","t":23.0,"m":true,"rssi":-72,"snr":7.2}'
echo "✓ sensors/2 - T:23.0°C M:OUI"

# Capteur 3 - Température élevée + présence
mosquitto_pub -h $BROKER -p $PORT \
  -t "sensors/3" \
  -m '{"sensor_id":"sensor_003","t":28.3,"m":true,"rssi":-80,"snr":5.1}'
echo "✓ sensors/3 - T:28.3°C M:OUI"

# Capteur 4 - Couloir froid
mosquitto_pub -h $BROKER -p $PORT \
  -t "sensors/4" \
  -m '{"sensor_id":"sensor_004","t":17.2,"m":false,"rssi":-55,"snr":11.0}'
echo "✓ sensors/4 - T:17.2°C M:NON"

# Capteur 5 - Salle serveur très chaude
mosquitto_pub -h $BROKER -p $PORT \
  -t "sensors/5" \
  -m '{"sensor_id":"sensor_005","t":35.8,"m":false,"rssi":-60,"snr":8.4}'
echo "✓ sensors/5 - T:35.8°C M:NON"

echo ""
echo "Terminé ! 5 capteurs publiés."
