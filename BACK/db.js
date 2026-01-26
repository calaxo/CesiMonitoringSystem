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

    // Créer la table des capteurs (cartes Arduino émettrices)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS sensors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sensor_id VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255),
        location VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sensor_id (sensor_id)
      )
    `);
    console.log("✅ Table sensors prête");

    // Créer la table des données de capteurs
    await conn.query(`
      CREATE TABLE IF NOT EXISTS sensor_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sensor_fk INT NOT NULL,
        temperature DECIMAL(5, 2),
        presence BOOLEAN,
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sensor_fk) REFERENCES sensors(id) ON DELETE CASCADE,
        INDEX idx_sensor_fk (sensor_fk),
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
 * Récupère ou crée un capteur par son ID unique
 * @param {string} sensorId - ID unique du capteur Arduino
 * @returns {Promise<number>} - ID de la clé primaire du capteur
 */
async function getOrCreateSensor(sensorId) {
  const conn = await pool.getConnection();
  try {
    // Vérifier si le capteur existe déjà
    const existing = await conn.query(
      "SELECT id FROM sensors WHERE sensor_id = ?",
      [sensorId]
    );

    if (existing.length > 0) {
      return existing[0].id;
    }

    // Créer le capteur s'il n'existe pas
    const result = await conn.query(
      "INSERT INTO sensors (sensor_id) VALUES (?)",
      [sensorId]
    );

    return Number(result.insertId);
  } finally {
    conn.release();
  }
}

/**
 * Récupère tous les capteurs enregistrés
 * @returns {Promise<Array>}
 */
async function getAllSensors() {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(
      "SELECT * FROM sensors ORDER BY created_at DESC"
    );
    return rows;
  } finally {
    conn.release();
  }
}

/**
 * Met à jour les informations d'un capteur
 * @param {string} sensorId - ID unique du capteur
 * @param {object} data - Données à mettre à jour (name, location)
 * @returns {Promise<object>}
 */
async function updateSensor(sensorId, data) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      "UPDATE sensors SET name = ?, location = ? WHERE sensor_id = ?",
      [data.name || null, data.location || null, sensorId]
    );
    return result;
  } finally {
    conn.release();
  }
}

/**
 * Insère des données de capteur dans la base
 * @param {object} data - Données du message MQTT
 * @param {string} data.sensor_id - ID unique du capteur Arduino
 * @param {number} [data.temperature] - Température mesurée
 * @param {boolean} [data.presence] - Présence détectée
 * @returns {Promise<object>}
 */
async function insertSensorData(data) {
  const conn = await pool.getConnection();
  try {
    // Récupérer ou créer le capteur
    const sensorFk = await getOrCreateSensor(data.sensor_id);

    // Insérer les données (received_at est auto-généré par MariaDB)
    const result = await conn.query(
      `INSERT INTO sensor_data (sensor_fk, temperature, presence) 
       VALUES (?, ?, ?)`,
      [
        sensorFk,
        data.temperature !== undefined ? data.temperature : null,
        data.presence !== undefined ? data.presence : null
      ]
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
    let query = `
      SELECT sd.*, s.sensor_id, s.name as sensor_name, s.location as sensor_location
      FROM sensor_data sd
      INNER JOIN sensors s ON sd.sensor_fk = s.id
    `;
    const params = [];
    const conditions = [];

    if (options.sensorId) {
      conditions.push("s.sensor_id = ?");
      params.push(options.sensorId);
    }

    if (options.from) {
      conditions.push("sd.received_at >= ?");
      params.push(options.from);
    }

    if (options.to) {
      conditions.push("sd.received_at <= ?");
      params.push(options.to);
    }

    // Filtrer par type de donnée (temperature ou presence)
    if (options.dataType === 'temperature') {
      conditions.push("sd.temperature IS NOT NULL");
    } else if (options.dataType === 'presence') {
      conditions.push("sd.presence IS NOT NULL");
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY sd.received_at DESC";

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
      SELECT sd.*, s.sensor_id, s.name as sensor_name, s.location as sensor_location
      FROM sensor_data sd
      INNER JOIN sensors s ON sd.sensor_fk = s.id
      INNER JOIN (
        SELECT sensor_fk, MAX(received_at) as max_received_at
        FROM sensor_data
        GROUP BY sensor_fk
      ) latest ON sd.sensor_fk = latest.sensor_fk AND sd.received_at = latest.max_received_at
      ORDER BY sd.received_at DESC
    `);
    return rows;
  } finally {
    conn.release();
  }
}

/**
 * Récupère les dernières données de température pour chaque capteur
 * @returns {Promise<Array>}
 */
async function getLatestTemperatureData() {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(`
      SELECT sd.*, s.sensor_id, s.name as sensor_name, s.location as sensor_location
      FROM sensor_data sd
      INNER JOIN sensors s ON sd.sensor_fk = s.id
      INNER JOIN (
        SELECT sensor_fk, MAX(received_at) as max_received_at
        FROM sensor_data
        WHERE temperature IS NOT NULL
        GROUP BY sensor_fk
      ) latest ON sd.sensor_fk = latest.sensor_fk AND sd.received_at = latest.max_received_at
      WHERE sd.temperature IS NOT NULL
      ORDER BY sd.received_at DESC
    `);
    return rows;
  } finally {
    conn.release();
  }
}

/**
 * Récupère les dernières données de présence pour chaque capteur
 * @returns {Promise<Array>}
 */
async function getLatestPresenceData() {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(`
      SELECT sd.*, s.sensor_id, s.name as sensor_name, s.location as sensor_location
      FROM sensor_data sd
      INNER JOIN sensors s ON sd.sensor_fk = s.id
      INNER JOIN (
        SELECT sensor_fk, MAX(received_at) as max_received_at
        FROM sensor_data
        WHERE presence IS NOT NULL
        GROUP BY sensor_fk
      ) latest ON sd.sensor_fk = latest.sensor_fk AND sd.received_at = latest.max_received_at
      WHERE sd.presence IS NOT NULL
      ORDER BY sd.received_at DESC
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
      "SELECT COUNT(*) as count FROM sensors"
    );
    const temperatureReadings = await conn.query(
      "SELECT COUNT(*) as count FROM sensor_data WHERE temperature IS NOT NULL"
    );
    const presenceReadings = await conn.query(
      "SELECT COUNT(*) as count FROM sensor_data WHERE presence IS NOT NULL"
    );
    const lastMessage = await conn.query(
      "SELECT received_at FROM sensor_data ORDER BY received_at DESC LIMIT 1"
    );
    const avgTemperature = await conn.query(
      "SELECT AVG(temperature) as avg FROM sensor_data WHERE temperature IS NOT NULL"
    );
    const activePresence = await conn.query(
      "SELECT COUNT(*) as count FROM sensor_data sd INNER JOIN (SELECT sensor_fk, MAX(received_at) as max_ts FROM sensor_data WHERE presence IS NOT NULL GROUP BY sensor_fk) latest ON sd.sensor_fk = latest.sensor_fk AND sd.received_at = latest.max_ts WHERE sd.presence = true"
    );

    return {
      totalMessages: Number(totalMessages[0].count),
      uniqueSensors: Number(uniqueSensors[0].count),
      temperatureReadings: Number(temperatureReadings[0].count),
      presenceReadings: Number(presenceReadings[0].count),
      lastMessageAt: lastMessage[0]?.received_at || null,
      avgTemperature: avgTemperature[0]?.avg ? Number(avgTemperature[0].avg).toFixed(2) : null,
      activePresenceCount: Number(activePresence[0].count)
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
  getOrCreateSensor,
  getAllSensors,
  updateSensor,
  insertSensorData,
  getAllSensorData,
  getLatestSensorData,
  getLatestTemperatureData,
  getLatestPresenceData,
  getSensorStats,
  closeDatabase
};
