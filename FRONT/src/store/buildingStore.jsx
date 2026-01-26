import { create } from "zustand";

const MAX_HISTORY_SIZE = 1000;

export const useBuildingStore = create((set, get) => ({
  // État des plans et sélection
  floorPlans: [],
  selectedFloor: localStorage.getItem("selectedFloor") || null,
  selectedRoom: null,

  // Données des capteurs
  sensorData: new Map(),
  sensorHistory: new Map(),
  sensorRegistry: new Map(), // Mapping sensor_id -> room_id

  // État de connexion
  isConnected: false,
  isApiConnected: false,
  isMqttConnected: false,
  error: null,

  // UI
  activeTab: "dashboard",
  isLoading: false,

  // Stats globales (depuis l'API)
  globalStats: null,

  setFloorPlans: (plans) => {
    set({ floorPlans: plans });
    if (plans.length > 0 && !get().selectedFloor) {
      const firstFloorId = plans[0].id;
      set({ selectedFloor: firstFloorId });
      localStorage.setItem("selectedFloor", firstFloorId);
    }
  },

  setSelectedRoom: (roomId) => {
    set({ selectedRoom: roomId });
  },

  setSelectedFloor: (floorId) => {
    set({ selectedFloor: floorId });
    if (floorId) {
      localStorage.setItem("selectedFloor", floorId);
    } else {
      localStorage.removeItem("selectedFloor");
    }
  },

  updateSensorData: (roomId, data) => {
    const currentData = get().sensorData;
    const newData = new Map(currentData);

    // Fusionner avec les données existantes
    const existingData = newData.get(roomId) || {};
    const mergedData = {
      ...existingData,
      ...data,
      lastUpdate: data.lastUpdate || new Date().toISOString(),
    };
    newData.set(roomId, mergedData);

    // Ajoute à l'historique
    const currentHistory = get().sensorHistory;
    const newHistory = new Map(currentHistory);
    const roomHistory = newHistory.get(roomId) || [];

    // Ajouter uniquement si les données ont changé
    const lastEntry = roomHistory[roomHistory.length - 1];
    const hasChanged =
      !lastEntry ||
      lastEntry.temperature !== data.temperature ||
      lastEntry.occupied !== data.occupied;

    if (hasChanged) {
      roomHistory.push({
        ...mergedData,
        timestamp: new Date().toISOString(),
      });
      if (roomHistory.length > MAX_HISTORY_SIZE) {
        roomHistory.shift();
      }
      newHistory.set(roomId, roomHistory);
    }

    set({ sensorData: newData, sensorHistory: newHistory });
  },

  // Mise à jour en batch depuis l'API (plus efficace)
  batchUpdateSensorData: (dataMap) => {
    const currentData = get().sensorData;
    const newData = new Map(currentData);
    const currentHistory = get().sensorHistory;
    const newHistory = new Map(currentHistory);

    dataMap.forEach((data, roomId) => {
      const existingData = newData.get(roomId) || {};
      const mergedData = {
        ...existingData,
        ...data,
        lastUpdate: data.lastUpdate || new Date().toISOString(),
      };
      newData.set(roomId, mergedData);

      // Historique
      const roomHistory = newHistory.get(roomId) || [];
      roomHistory.push({
        ...mergedData,
        timestamp: new Date().toISOString(),
      });
      if (roomHistory.length > MAX_HISTORY_SIZE) {
        roomHistory.shift();
      }
      newHistory.set(roomId, roomHistory);
    });

    set({ sensorData: newData, sensorHistory: newHistory });
  },

  // Enregistrer un capteur et son mapping vers une salle
  registerSensor: (sensorId, roomId) => {
    const registry = new Map(get().sensorRegistry);
    registry.set(sensorId, roomId);
    set({ sensorRegistry: registry });
  },

  // Récupérer le roomId pour un sensorId
  getRoomIdForSensor: (sensorId) => {
    return get().sensorRegistry.get(sensorId);
  },

  setConnectionStatus: (isConnected) => {
    set({ isConnected });
  },

  setApiConnectionStatus: (isApiConnected) => {
    set({
      isApiConnected,
      isConnected: isApiConnected || get().isMqttConnected,
    });
  },

  setMqttConnectionStatus: (isMqttConnected) => {
    set({
      isMqttConnected,
      isConnected: isMqttConnected || get().isApiConnected,
    });
  },

  setLoading: (isLoading) => {
    set({ isLoading });
  },

  setGlobalStats: (stats) => {
    set({ globalStats: stats });
  },

  setError: (error) => {
    set({ error });
  },

  getRoomData: (roomId) => {
    return get().sensorData.get(roomId);
  },

  getSelectedFloorRooms: () => {
    const { floorPlans, selectedFloor } = get();
    const floor = floorPlans.find((f) => f.id === selectedFloor);
    return floor?.rooms || [];
  },

  clearSensorData: () => {
    set({ sensorData: new Map(), sensorHistory: new Map() });
  },

  getSensorHistory: (roomId) => {
    return get().sensorHistory.get(roomId) || [];
  },

  setActiveTab: (tab) => {
    set({ activeTab: tab });
  },
}));
