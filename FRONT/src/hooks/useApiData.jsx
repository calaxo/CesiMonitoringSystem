import { useEffect, useState, useCallback, useRef } from "react";
import { useBuildingStore } from "../store/buildingStore";
import * as apiService from "../services/apiService";

/**
 * Hook pour charger les données depuis l'API backend
 *
 * Stratégie de chargement:
 * 1. Chargement initial des dernières données au mount
 * 2. Polling optionnel pour rafraîchir les données périodiquement
 * 3. Récupération de l'historique à la demande
 */
export const useApiData = (options = {}) => {
  const {
    autoLoad = true, // Charger automatiquement au mount
    pollingInterval = 5000, // Intervalle de polling en ms (0 = désactivé)
    loadHistory = false, // Charger l'historique au démarrage
    historyLimit = 100, // Limite pour l'historique
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [sensors, setSensors] = useState([]);
  const [serverStatus, setServerStatus] = useState(null);

  const pollingRef = useRef(null);

  const {
    floorPlans,
    updateSensorData,
    setApiConnectionStatus,
    setError: setStoreError,
    setGlobalStats,
  } = useBuildingStore();

  /**
   * Vérifie la connexion au serveur
   */
  const checkServerHealth = useCallback(async () => {
    try {
      const health = await apiService.getHealthStatus();
      setServerStatus(health);
      return health.status === "ok";
    } catch (err) {
      setServerStatus({ status: "error", error: err.message });
      return false;
    }
  }, []);

  /**
   * Charge les dernières données de tous les capteurs
   * et les mappe aux salles du plan
   */
  const loadLatestData = useCallback(async () => {
    if (floorPlans.length === 0) {
      console.warn(
        "useApiData: Aucun plan chargé, impossible de mapper les données",
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Récupérer les dernières données de tous les capteurs
      const latestData = await apiService.getLatestSensorData();

      // Mapper les données aux salles
      const roomDataMap = apiService.mapSensorsToRooms(latestData, floorPlans);

      // Mettre à jour le store pour chaque salle
      roomDataMap.forEach((data, roomId) => {
        updateSensorData(roomId, {
          temperature: data.temperature,
          occupied: data.presence,
          lastUpdate: data.lastUpdate,
          source: "api", // Pour distinguer des données MQTT temps réel
        });
      });

      setApiConnectionStatus(true);
      console.log(`✅ ${roomDataMap.size} salles mises à jour depuis l'API`);

      return roomDataMap;
    } catch (err) {
      const message = err.message || "Erreur lors du chargement des données";
      setError(message);
      setStoreError(`API: ${message}`);
      console.error("Erreur chargement API:", err);
    } finally {
      setIsLoading(false);
    }
  }, [floorPlans, updateSensorData, setApiConnectionStatus, setStoreError]);

  /**
   * Charge la liste des capteurs enregistrés
   */
  const loadSensors = useCallback(async () => {
    try {
      const sensorList = await apiService.getAllSensors();
      setSensors(sensorList);
      return sensorList;
    } catch (err) {
      console.error("Erreur chargement capteurs:", err);
      throw err;
    }
  }, []);

  /**
   * Charge les statistiques globales
   */
  const loadStats = useCallback(async () => {
    try {
      const statsData = await apiService.getSensorStats();
      setStats(statsData);
      setGlobalStats(statsData);
      return statsData;
    } catch (err) {
      console.error("Erreur chargement stats:", err);
      throw err;
    }
  }, [setGlobalStats]);

  /**
   * Charge l'historique pour une salle/capteur spécifique
   */
  const loadSensorHistory = useCallback(
    async (sensorId, options = {}) => {
      try {
        const history = await apiService.getSensorHistory({
          sensorId,
          limit: options.limit || historyLimit,
          ...options,
        });
        return history;
      } catch (err) {
        console.error("Erreur chargement historique:", err);
        throw err;
      }
    },
    [historyLimit],
  );

  /**
   * Charge l'historique des températures
   */
  const loadTemperatureHistory = useCallback(
    async (sensorId, options = {}) => {
      return loadSensorHistory(sensorId, {
        ...options,
        dataType: "temperature",
      });
    },
    [loadSensorHistory],
  );

  /**
   * Charge l'historique des présences
   */
  const loadPresenceHistory = useCallback(
    async (sensorId, options = {}) => {
      return loadSensorHistory(sensorId, { ...options, dataType: "presence" });
    },
    [loadSensorHistory],
  );

  /**
   * Rafraîchit toutes les données
   */
  const refresh = useCallback(async () => {
    await Promise.all([loadLatestData(), loadStats()]);
  }, [loadLatestData, loadStats]);

  /**
   * Démarre le polling pour rafraîchir les données périodiquement
   */
  const startPolling = useCallback(
    (interval = pollingInterval) => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }

      if (interval > 0) {
        pollingRef.current = setInterval(() => {
          loadLatestData();
          loadStats(); // Rafraîchir aussi les stats
        }, interval);
        console.log(`🔄 Polling API démarré (${interval}ms)`);
      }
    },
    [pollingInterval, loadLatestData, loadStats],
  );

  /**
   * Arrête le polling
   */
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
      console.log("⏹️ Polling API arrêté");
    }
  }, []);

  // Chargement automatique au mount
  useEffect(() => {
    if (autoLoad && floorPlans.length > 0) {
      loadLatestData();
      loadSensors();
      loadStats();
    }
  }, [autoLoad, floorPlans.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Gestion du polling
  useEffect(() => {
    if (pollingInterval > 0 && floorPlans.length > 0) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [pollingInterval, floorPlans.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup au unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    // État
    isLoading,
    error,
    stats,
    sensors,
    serverStatus,

    // Actions
    loadLatestData,
    loadSensors,
    loadStats,
    loadSensorHistory,
    loadTemperatureHistory,
    loadPresenceHistory,
    refresh,
    checkServerHealth,

    // Polling
    startPolling,
    stopPolling,
  };
};

export default useApiData;
