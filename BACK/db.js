const mariadb = require("mariadb");

let pool = null;

/**
 * Initialise le pool de connexions MariaDB
 * @returns {Promise<mariadb.Pool>}
 */
async function initDatabase() {
  if (pool) {
    return pool;
  }

  pool = mariadb.createPool({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "monitoring",
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    acquireTimeout: 30000,
  });

  // Tester la connexion
  let conn;
  try {
    conn = await pool.getConnection();
    console.log("✅ Connexion à MariaDB établie");

    // Créer la table si elle n'existe pas
    await conn.query(`
      CREATE TABLE IF NOT EXISTS sensor_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        topic VARCHAR(255) NOT NULL,
        payload JSON NOT NULL,
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sensor_id VARCHAR(100),
        sensor_type VARCHAR(50),
        value DECIMAL(10, 2),
        unit VARCHAR(20),
        INDEX idx_topic (topic),
        INDEX idx_sensor_id (sensor_id),
        INDEX idx_received_at (received_at)
      )
    `);
    console.log("✅ Table sensor_data prête");

  } catch (err) {
    console.error("❌ Erreur de connexion à MariaDB:", err.message);
    throw err;
  } finally {
    if (conn) conn.release();
  }

  return pool;
}

/**
 * Récupère le pool de connexions
 * @returns {mariadb.Pool}
 */
function getPool() {
  if (!pool) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return pool;
}

/**
 * Insère des données de capteur dans la base
 * @param {string} topic - Topic MQTT
 * @param {object} payload - Données du message
 * @returns {Promise<object>}
 */
async function insertSensorData(topic, payload) {
  const conn = await pool.getConnection();
  try {
    // Extraire les informations du payload si disponibles
    const sensorId = payload.sensor_id || payload.sensorId || payload.id || null;
    const sensorType = payload.type || payload.sensor_type || null;
    const value = payload.value || payload.data || null;
    const unit = payload.unit || null;

    const result = await conn.query(
      `INSERT INTO sensor_data (topic, payload, sensor_id, sensor_type, value, unit) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [topic, JSON.stringify(payload), sensorId, sensorType, value, unit]
    );

    return result;
  } finally {
    conn.release();
  }
}

/**
 * Récupère toutes les données de capteurs
 * @param {object} options - Options de filtrage
 * @returns {Promise<Array>}
 */
async function getAllSensorData(options = {}) {
  const conn = await pool.getConnection();
  try {
    let query = "SELECT * FROM sensor_data";
    const params = [];
    const conditions = [];

    if (options.topic) {
      conditions.push("topic = ?");
      params.push(options.topic);
    }

    if (options.sensorId) {
      conditions.push("sensor_id = ?");
      params.push(options.sensorId);
    }

    if (options.sensorType) {
      conditions.push("sensor_type = ?");
      params.push(options.sensorType);
    }

    if (options.from) {
      conditions.push("received_at >= ?");
      params.push(options.from);
    }

    if (options.to) {
      conditions.push("received_at <= ?");
      params.push(options.to);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY received_at DESC";

    if (options.limit) {
      query += " LIMIT ?";
      params.push(parseInt(options.limit));
    }

    if (options.offset) {
      query += " OFFSET ?";
      params.push(parseInt(options.offset));
    }

    const rows = await conn.query(query, params);
    return rows;
  } finally {
    conn.release();
  }
}

/**
 * Récupère les dernières données pour chaque capteur
 * @returns {Promise<Array>}
 */
async function getLatestSensorData() {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(`
      SELECT s1.* FROM sensor_data s1
      INNER JOIN (
        SELECT sensor_id, MAX(received_at) as max_date
        FROM sensor_data
        WHERE sensor_id IS NOT NULL
        GROUP BY sensor_id
      ) s2 ON s1.sensor_id = s2.sensor_id AND s1.received_at = s2.max_date
      ORDER BY s1.received_at DESC
    `);
    return rows;
  } finally {
    conn.release();
  }
}

/**
 * Récupère les statistiques des capteurs
 * @returns {Promise<object>}
 */
async function getSensorStats() {
  const conn = await pool.getConnection();
  try {
    const totalMessages = await conn.query(
      "SELECT COUNT(*) as count FROM sensor_data"
    );
    const uniqueSensors = await conn.query(
      "SELECT COUNT(DISTINCT sensor_id) as count FROM sensor_data WHERE sensor_id IS NOT NULL"
    );
    const uniqueTopics = await conn.query(
      "SELECT COUNT(DISTINCT topic) as count FROM sensor_data"
    );
    const lastMessage = await conn.query(
      "SELECT received_at FROM sensor_data ORDER BY received_at DESC LIMIT 1"
    );

    return {
      totalMessages: Number(totalMessages[0].count),
      uniqueSensors: Number(uniqueSensors[0].count),
      uniqueTopics: Number(uniqueTopics[0].count),
      lastMessageAt: lastMessage[0]?.received_at || null
    };
  } finally {
    conn.release();
  }
}

/**
 * Ferme le pool de connexions
 */
async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log("🔌 Connexion MariaDB fermée");
  }
}

module.exports = {
  initDatabase,
  getPool,
  insertSensorData,
  getAllSensorData,
  getLatestSensorData,
  getSensorStats,
  closeDatabase
};
