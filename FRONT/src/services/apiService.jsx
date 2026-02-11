/**
 * Service API pour communiquer avec le backend
 * Gère les appels HTTP vers l'API REST du serveur
 */

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5500/api";

/**
 * Wrapper pour les appels fetch avec gestion d'erreurs
 */
async function fetchApi(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || `Erreur HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

/**
 * Vérifie l'état du serveur et de la connexion MQTT
 * Note: /health ne retourne pas le format standard avec 'success'
 */
export async function getHealthStatus() {
  const url = `${API_BASE_URL}/health`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("API Error [/health]:", error);
    throw error;
  }
}

/**
 * Récupère la liste de tous les capteurs enregistrés
 * Utile pour mapper les sensor_id aux locations (rooms)
 */
export async function getAllSensors() {
  const response = await fetchApi("/sensors/list");
  return response.data || [];
}

/**
 * Récupère les dernières données de tous les capteurs
 * Appel unique au chargement pour initialiser l'état
 */
export async function getLatestSensorData() {
  const response = await fetchApi("/sensors/latest");
  return response.data || [];
}

/**
 * Récupère les dernières températures de tous les capteurs
 */
export async function getLatestTemperatures() {
  const response = await fetchApi("/sensors/latest/temperature");
  return response.data || [];
}

/**
 * Récupère les dernières données de présence de tous les capteurs
 */
export async function getLatestPresence() {
  const response = await fetchApi("/sensors/latest/presence");
  return response.data || [];
}

/**
 * Récupère les statistiques globales des capteurs
 * Utilisé pour les KPIs
 */
export async function getSensorStats() {
  const response = await fetchApi("/sensors/stats");
  return response.data || {};
}

/**
 * Récupère les données d'un capteur spécifique
 * @param {string} sensorId - ID du capteur
 * @param {object} options - Options de filtrage (dataType, limit, offset)
 */
export async function getSensorData(sensorId, options = {}) {
  const params = new URLSearchParams();

  if (options.dataType) params.append("dataType", options.dataType);
  if (options.limit) params.append("limit", options.limit);
  if (options.offset) params.append("offset", options.offset);

  const queryString = params.toString();
  const endpoint = `/sensors/${encodeURIComponent(sensorId)}${queryString ? `?${queryString}` : ""}`;

  const response = await fetchApi(endpoint);
  return response.data || [];
}

/**
 * Récupère l'historique des données avec filtres
 * @param {object} options - Options de filtrage
 * @param {string} [options.sensorId] - Filtrer par capteur
 * @param {string} [options.dataType] - 'temperature' ou 'presence'
 * @param {string} [options.from] - Date de début (ISO string)
 * @param {string} [options.to] - Date de fin (ISO string)
 * @param {number} [options.limit] - Nombre max de résultats
 * @param {number} [options.offset] - Offset pour pagination
 */
export async function getSensorHistory(options = {}) {
  const params = new URLSearchParams();

  if (options.sensorId) params.append("sensorId", options.sensorId);
  if (options.dataType) params.append("dataType", options.dataType);
  if (options.from) params.append("from", options.from);
  if (options.to) params.append("to", options.to);
  if (options.limit) params.append("limit", options.limit);
  if (options.offset) params.append("offset", options.offset);

  const queryString = params.toString();
  const response = await fetchApi(
    `/sensors${queryString ? `?${queryString}` : ""}`,
  );
  return response.data || [];
}

/**
 * Met à jour les informations d'un capteur (nom, location)
 * @param {string} sensorId - ID du capteur
 * @param {object} data - Données à mettre à jour
 */
export async function updateSensor(sensorId, data) {
  return fetchApi(`/sensors/${encodeURIComponent(sensorId)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}



/**
 * Mapping des sensor_id vers les room_id du plan
 * Cette fonction fait correspondre les données des capteurs aux salles
 * @param {Array} sensorData - Données des capteurs de l'API
 * @param {Array} floorPlans - Plans d'étages avec les salles
 * @returns {Map} Map roomId -> sensorData
 */
export function mapSensorsToRooms(sensorData, floorPlans) {
  const roomDataMap = new Map();

  // Créer un index des salles par ID et par nom
  const roomIndex = new Map();
  floorPlans.forEach((floor) => {
    floor.rooms?.forEach((room) => {
      roomIndex.set(room.id, room);
      roomIndex.set(room.name, room);
      // Ajouter des variantes courantes
      roomIndex.set(room.id.toLowerCase(), room);
      roomIndex.set(room.name.toLowerCase(), room);
    });
  });

  sensorData.forEach((sensor) => {
    // Essayer de trouver la salle correspondante
    // En priorité: sensor_location, puis sensor_name, puis sensor_id
    const possibleMatches = [
      sensor.sensor_location,
      sensor.sensor_name,
      sensor.sensor_id,
    ].filter(Boolean);

    let matchedRoom = null;
    for (const key of possibleMatches) {
      matchedRoom = roomIndex.get(key) || roomIndex.get(key?.toLowerCase());
      if (matchedRoom) break;
    }

    if (matchedRoom) {
      roomDataMap.set(matchedRoom.id, {
        temperature: sensor.temperature,
        presence: sensor.presence,
        lastUpdate: sensor.received_at,
        sensorId: sensor.sensor_id,
        sensorName: sensor.sensor_name,
      });
    }
  });

  return roomDataMap;
}

export default {
  getHealthStatus,
  getAllSensors,
  getLatestSensorData,
  getLatestTemperatures,
  getLatestPresence,
  getSensorStats,
  getSensorData,
  getSensorHistory,
  updateSensor,
  mapSensorsToRooms,
};
