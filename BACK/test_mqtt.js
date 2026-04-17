/**
 * Script de test MQTT - publie des données simulées de capteurs
 * Usage: node test_mqtt.js [--loop] [--no-hmac]
 *
 * Options:
 *   --loop     Envoie des données en boucle toutes les 5 secondes
 *   --no-hmac  Envoie sans HMAC (messages non signés, acceptés quand même)
 */

const mqtt = require("mqtt");
const crypto = require("crypto");

const BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const LOOP = process.argv.includes("--loop");
const NO_HMAC = process.argv.includes("--no-hmac");

// Clé HMAC identique au backend
const HMAC_KEY = Buffer.from([
  0xca, 0xfe, 0xba, 0xbe, 0xde, 0xad, 0xbe, 0xef,
  0xca, 0xfe, 0xba, 0xbe, 0xde, 0xad, 0xbe, 0xef,
]);

function computeHmac(temperature, motion) {
  const tempStr = Number(temperature).toFixed(1);
  const motionStr = motion ? "true" : "false";
  const message = `{"t":${tempStr},"m":${motionStr}}`;
  const hmac = crypto.createHmac("sha256", HMAC_KEY);
  hmac.update(message);
  return hmac.digest("hex").substring(0, 16);
}

function buildPayload(sensorId, temperature, motion, rssi, snr) {
  const payload = {
    sensor_id: sensorId,
    t: temperature,
    m: motion,
  };
  if (rssi !== undefined) payload.rssi = rssi;
  if (snr !== undefined) payload.snr = snr;
  if (!NO_HMAC) {
    payload.hmac = computeHmac(temperature, motion);
  }
  return payload;
}

// Scénarios de test - modifie ces valeurs comme tu veux
const SCENARIOS = [
  {
    topic: "sensors/1",
    label: "Salle 1 - Normal",
    payload: () => buildPayload("sensor_001", 21.5, false, -65, 9.5),
  },
  {
    topic: "sensors/2",
    label: "Salle 2 - Présence détectée",
    payload: () => buildPayload("sensor_002", 23.0, true, -72, 7.2),
  },
  {
    topic: "sensors/3",
    label: "Salle 3 - Température élevée",
    payload: () => buildPayload("sensor_003", 28.3, true, -80, 5.1),
  },
  {
    topic: "sensors/4",
    label: "Couloir - Froid, pas de présence",
    payload: () => buildPayload("sensor_004", 17.2, false, -55, 11.0),
  },
  {
    topic: "sensors/5",
    label: "Serveur - Très chaud",
    payload: () => buildPayload("sensor_005", 35.8, false, -60, 8.4),
  },
];

// Scénario aléatoire (utile en --loop pour simuler du vrai trafic)
function randomPayload(index) {
  const id = String(index + 1).padStart(3, "0");
  const temp = +(18 + Math.random() * 15).toFixed(1); // 18..33°C
  const motion = Math.random() > 0.6;
  const rssi = -(50 + Math.floor(Math.random() * 40));
  const snr = +(5 + Math.random() * 8).toFixed(1);
  return {
    topic: `sensors/${index + 1}`,
    label: `sensor_${id} aléatoire`,
    payload: () => buildPayload(`sensor_${id}`, temp, motion, rssi, snr),
  };
}

async function publishAll(client, useRandom = false) {
  const scenarios = useRandom
    ? SCENARIOS.map((_, i) => randomPayload(i))
    : SCENARIOS;

  for (const scenario of scenarios) {
    const payload = scenario.payload();
    const json = JSON.stringify(payload);

    await new Promise((resolve, reject) => {
      // QoS 1 = livraison garantie au moins une fois (ACK du broker)
      // retain = true → le broker garde ce message pour les nouveaux abonnés
      client.publish(scenario.topic, json, { qos: 1, retain: true }, (err) => {
        if (err) return reject(err);
        const hmacInfo = NO_HMAC ? "(sans HMAC)" : `hmac:${payload.hmac}`;
        console.log(
          `[PUBLISH] ${scenario.topic} | ${scenario.label}\n` +
          `          T:${payload.t}°C  M:${payload.m ? "OUI" : "NON"}  RSSI:${payload.rssi}  SNR:${payload.snr}  ${hmacInfo}`
        );
        resolve();
      });
    });
  }
}

// --- Main ---
console.log(`Connexion à ${BROKER_URL}...`);
const client = mqtt.connect(BROKER_URL, {
  clientId: `mqtt_test_${Date.now()}`,
  clean: true,
  connectTimeout: 5000,
});

client.on("connect", async () => {
  console.log(`Connecté ! Mode: ${LOOP ? "boucle 5s" : "envoi unique"} | HMAC: ${NO_HMAC ? "désactivé" : "activé"}\n`);

  await publishAll(client, false);

  if (LOOP) {
    console.log("\nBoucle activée - Ctrl+C pour arrêter\n");
    setInterval(async () => {
      console.log(`\n--- ${new Date().toLocaleTimeString()} ---`);
      await publishAll(client, true); // données aléatoires en boucle
    }, 5000);
  } else {
    console.log("\nTerminé.");
    client.end();
  }
});

client.on("error", (err) => {
  console.error("Erreur MQTT:", err.message);
  process.exit(1);
});
