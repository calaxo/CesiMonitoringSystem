import { create } from 'zustand';

const MAX_HISTORY_SIZE = 1000;

export const useBuildingStore = create((set, get) => ({
  floorPlans: [],
  selectedFloor: localStorage.getItem('selectedFloor') || null,
  sensorData: new Map(),
  sensorHistory: new Map(),
  isConnected: false,
  error: null,
  activeTab: 'dashboard',

  setFloorPlans: (plans) => {
    set({ floorPlans: plans });
    if (plans.length > 0 && !get().selectedFloor) {
      const firstFloorId = plans[0].id;
      set({ selectedFloor: firstFloorId });
      localStorage.setItem('selectedFloor', firstFloorId);
    }
  },

  setSelectedFloor: (floorId) => {
    set({ selectedFloor: floorId });
    if (floorId) {
      localStorage.setItem('selectedFloor', floorId);
    } else {
      localStorage.removeItem('selectedFloor');
    }
  },

  updateSensorData: (roomId, data) => {
    const currentData = get().sensorData;
    const newData = new Map(currentData);
    newData.set(roomId, data);
    
    // Ajoute à l'historique
    const currentHistory = get().sensorHistory;
    const newHistory = new Map(currentHistory);
    const roomHistory = newHistory.get(roomId) || [];
    roomHistory.push(data);
    if (roomHistory.length > MAX_HISTORY_SIZE) {
      roomHistory.shift();
    }
    newHistory.set(roomId, roomHistory);
    
    set({ sensorData: newData, sensorHistory: newHistory });
  },

  setConnectionStatus: (isConnected) => {
    set({ isConnected });
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
