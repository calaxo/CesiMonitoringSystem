const mqtt = require("mqtt");
const crypto = require("crypto");
const { insertSensorData } = require("./db");

let client = null;

// Clé HMAC (DOIT être la même que sur les capteurs!)
const HMAC_KEY = Buffer.from([0xCA, 0xFE, 0xBA, 0xBE, 0xDE, 0xAD, 0xBE, 0xEF, 
                              0xCA, 0xFE, 0xBA, 0xBE, 0xDE, 0xAD, 0xBE, 0xEF]);

/**
 * Vérifie le HMAC d'un message
 * @param {object} payload - Payload avec t, m et hmac
 * @returns {boolean} - True si HMAC valide
 */
function verifyHmac(payload) {
  if (!payload.hmac) {
    console.warn("Message sans HMAC");
    return false;
  }

  // Reconstruire le message original (sans hmac)
  // Note: dtostrf sur ESP32 formate avec 1 décimale, on doit reproduire exactement
  const tempStr = Number(payload.t).toFixed(1);
  const motionStr = payload.m ? "true" : "false";
  const messageForHmac = `{"t":${tempStr},"m":${motionStr}}`;

  // Calculer le HMAC SHA256
  const hmac = crypto.createHmac('sha256', HMAC_KEY);
  hmac.update(messageForHmac);
  const computedHmac = hmac.digest('hex').substring(0, 16); // 8 bytes = 16 hex chars

  if (computedHmac === payload.hmac) {
    return true;
  } else {
    console.warn(` HMAC invalide!`);
    console.warn(`   Message reconstruit: ${messageForHmac}`);
    console.warn(`   HMAC calculé: ${computedHmac}`);
    console.warn(`   HMAC reçu: ${payload.hmac}`);
    return false;
  }
}

/**
 * Initialise la connexion MQTT et s'abonne aux topics
 * @returns {Promise<mqtt.MqttClient>}
 */
async function initMQTT() {
  return new Promise((resolve, reject) => {
    const brokerUrl = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
    const topics = (process.env.MQTT_TOPICS || "sensors/#").split(",");

    const options = {
      clientId: process.env.MQTT_CLIENT_ID || "monitoring_server",
      // Session persistante : le broker mémorise les abonnements et messages
      // manqués si le serveur redémarre (QoS 1/2 uniquement)
      clean: false,
      connectTimeout: 10000,
      reconnectPeriod: 5000,
      // Last Will Testament : si le serveur se déconnecte brutalement,
      // le broker publie ce message automatiquement
      will: {
        topic: "status/server",
        payload: JSON.stringify({ status: "offline", ts: Date.now() }),
        qos: 1,
        retain: true,
      },
    };

    // Authentification si configurée
    if (process.env.MQTT_USERNAME) {
      options.username = process.env.MQTT_USERNAME;
    }
    if (process.env.MQTT_PASSWORD) {
      options.password = process.env.MQTT_PASSWORD;
    }

    console.log(`🔌 Connexion MQTT à ${brokerUrl}...`);
    client = mqtt.connect(brokerUrl, options);

    client.on("connect", () => {
      console.log("Connecté au broker MQTT");

      // Publier le statut "online" avec retain (dashboard sait que le serveur tourne)
      client.publish(
        "status/server",
        JSON.stringify({ status: "online", ts: Date.now() }),
        { qos: 1, retain: true }
      );

      // S'abonner aux topics avec QoS 1 (livraison garantie au moins une fois)
      topics.forEach((topic) => {
        const trimmedTopic = topic.trim();
        client.subscribe(trimmedTopic, { qos: 1 }, (err) => {
          if (err) {
            console.error(`Erreur abonnement au topic ${trimmedTopic}:`, err.message);
          } else {
            console.log(`Abonné au topic: ${trimmedTopic} (QoS 1)`);
          }
        });
      });

      resolve(client);
    });

    client.on("message", async (topic, message) => {
      try {
        const messageStr = message.toString();
        console.log(`Message reçu sur ${topic}: ${messageStr.substring(0, 100)}...`);

        // Parser le message JSON
        let payload;
        try {
          payload = JSON.parse(messageStr);
        } catch {
          console.warn("Message non-JSON ignoré:", messageStr.substring(0, 50));
          return;
        }

        // Vérifier que le message contient un sensor_id
        if (!payload.sensor_id) {
          console.warn("Message sans sensor_id ignoré");
          return;
        }

        // Vérifier le HMAC si présent (payload du capteur)
        if (payload.hmac !== undefined) {
          if (!verifyHmac(payload)) {
            console.warn(`⚠️ Message du capteur ${payload.sensor_id} rejeté (HMAC invalide)`);
            return;
          }
          console.log(`HMAC valide pour capteur ${payload.sensor_id}`);
        }

        // Mapper les champs courts vers les champs longs
        const normalizedPayload = {
          sensor_id: payload.sensor_id,
          temperature: payload.t !== undefined ? payload.t : payload.temperature,
          presence: payload.m !== undefined ? payload.m : payload.presence,
          rssi: payload.rssi,
          snr: payload.snr
        };

        // Insérer dans la base de données
        await insertSensorData(normalizedPayload);
        console.log(`Données sauvegardées pour capteur ${payload.sensor_id} (T:${normalizedPayload.temperature}°C, M:${normalizedPayload.presence ? 'OUI' : 'NON'})`);

      } catch (err) {
        console.error("Erreur traitement message MQTT:", err.message);
      }
    });

    client.on("error", (err) => {
      console.error("Erreur MQTT:", err.message);
      if (!client.connected) {
        reject(err);
      }
    });

    client.on("reconnect", () => {
      console.log("Reconnexion MQTT...");
    });

    client.on("offline", () => {
      console.log("MQTT hors ligne");
    });

    client.on("close", () => {
      console.log("Connexion MQTT fermée");
    });

    // Timeout de connexion
    setTimeout(() => {
      if (!client.connected) {
        reject(new Error("Timeout de connexion MQTT"));
      }
    }, 15000);
  });
}

/**
 * Récupère le client MQTT
 * @returns {mqtt.MqttClient}
 */
function getClient() {
  return client;
}

/**
 * Publie un message sur un topic
 * @param {string} topic - Topic MQTT
 * @param {object|string} message - Message à publier
 * @returns {Promise<void>}
 */
async function publish(topic, message, options = {}) {
  return new Promise((resolve, reject) => {
    if (!client || !client.connected) {
      reject(new Error("Client MQTT non connecté"));
      return;
    }

    const payload = typeof message === "string" ? message : JSON.stringify(message);

    // Par défaut : QoS 1 (livraison garantie), retain false
    const pubOptions = { qos: 1, retain: false, ...options };

    client.publish(topic, payload, pubOptions, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Ferme la connexion MQTT
 * @returns {Promise<void>}
 */
async function closeMQTT() {
  return new Promise((resolve) => {
    if (client) {
      client.end(true, () => {
        console.log("Connexion MQTT fermée proprement");
        client = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  initMQTT,
  getClient,
  publish,
  closeMQTT
};
