const express = require("express");
const { getAllSensorData, getLatestSensorData, getSensorStats } = require("./db");
const { publish, getClient } = require("./mqtt");

const router = express.Router();

/**
 * GET /api/health
 * Vérifier l'état du serveur
 */
router.get("/health", (req, res) => {
  const mqttClient = getClient();
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    mqtt: mqttClient?.connected ? "connected" : "disconnected"
  });
});

/**
 * GET /api/sensors
 * Récupérer toutes les données de capteurs avec filtrage optionnel
 * Query params: topic, sensorId, sensorType, from, to, limit, offset
 */
router.get("/sensors", async (req, res) => {
  try {
    const options = {
      topic: req.query.topic,
      sensorId: req.query.sensorId || req.query.sensor_id,
      sensorType: req.query.sensorType || req.query.sensor_type,
      from: req.query.from,
      to: req.query.to,
      limit: req.query.limit || 100,
      offset: req.query.offset || 0
    };

    const data = await getAllSensorData(options);
    
    // Convertir BigInt en Number si nécessaire
    const sanitizedData = data.map(row => ({
      ...row,
      id: Number(row.id),
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload
    }));

    res.json({
      success: true,
      count: sanitizedData.length,
      data: sanitizedData
    });
  } catch (err) {
    console.error("Erreur API /sensors:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /api/sensors/latest
 * Récupérer les dernières données pour chaque capteur
 */
router.get("/sensors/latest", async (req, res) => {
  try {
    const data = await getLatestSensorData();
    
    const sanitizedData = data.map(row => ({
      ...row,
      id: Number(row.id),
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload
    }));

    res.json({
      success: true,
      count: sanitizedData.length,
      data: sanitizedData
    });
  } catch (err) {
    console.error("Erreur API /sensors/latest:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /api/sensors/stats
 * Récupérer les statistiques des capteurs
 */
router.get("/sensors/stats", async (req, res) => {
  try {
    const stats = await getSensorStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    console.error("Erreur API /sensors/stats:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /api/sensors/:id
 * Récupérer les données d'un capteur spécifique
 */
router.get("/sensors/:id", async (req, res) => {
  try {
    const options = {
      sensorId: req.params.id,
      limit: req.query.limit || 100,
      offset: req.query.offset || 0
    };

    const data = await getAllSensorData(options);
    
    const sanitizedData = data.map(row => ({
      ...row,
      id: Number(row.id),
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload
    }));

    res.json({
      success: true,
      count: sanitizedData.length,
      data: sanitizedData
    });
  } catch (err) {
    console.error("Erreur API /sensors/:id:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * POST /api/mqtt/publish
 * Publier un message MQTT
 * Body: { topic: string, message: object|string }
 */
router.post("/mqtt/publish", async (req, res) => {
  try {
    const { topic, message } = req.body;

    if (!topic || !message) {
      return res.status(400).json({
        success: false,
        error: "Les champs 'topic' et 'message' sont requis"
      });
    }

    await publish(topic, message);
    
    res.json({
      success: true,
      message: "Message publié avec succès"
    });
  } catch (err) {
    console.error("Erreur API /mqtt/publish:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * Configure les routes API sur l'application Express
 * @param {express.Application} app - Instance Express
 */
function setupApiRoutes(app) {
  app.use("/api", router);
}

module.exports = {
  setupApiRoutes,
  router
};
