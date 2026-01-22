import { create } from 'zustand';
import type { BuildingState, FloorPlan, SensorData, Room } from '../types';

interface BuildingStore extends BuildingState {
  setFloorPlans: (plans: FloorPlan[]) => void;
  setSelectedFloor: (floorId: string | null) => void;
  updateSensorData: (roomId: string, data: SensorData) => void;
  setConnectionStatus: (isConnected: boolean) => void;
  setError: (error: string | null) => void;
  getRoomData: (roomId: string) => SensorData | undefined;
  getSelectedFloorRooms: () => Room[];
  clearSensorData: () => void;
  getSensorHistory: (roomId: string) => SensorData[];
  setActiveTab: (tab: 'dashboard' | 'kpi') => void;
}

const MAX_HISTORY_SIZE = 1000;

export const useBuildingStore = create<BuildingStore>((set, get) => ({
  floorPlans: [],
  selectedFloor: localStorage.getItem('selectedFloor') || null,
  sensorData: new Map(),
  sensorHistory: new Map(),
  isConnected: false,
  error: null,
  activeTab: 'dashboard',

  setFloorPlans: (plans: FloorPlan[]) => {
    set({ floorPlans: plans });
    if (plans.length > 0 && !get().selectedFloor) {
      const firstFloorId = plans[0].id;
      set({ selectedFloor: firstFloorId });
      localStorage.setItem('selectedFloor', firstFloorId);
    }
  },

  setSelectedFloor: (floorId: string | null) => {
    set({ selectedFloor: floorId });
    if (floorId) {
      localStorage.setItem('selectedFloor', floorId);
    } else {
      localStorage.removeItem('selectedFloor');
    }
  },

  updateSensorData: (roomId: string, data: SensorData) => {
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

  setConnectionStatus: (isConnected: boolean) => {
    set({ isConnected });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  getRoomData: (roomId: string) => {
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

  getSensorHistory: (roomId: string) => {
    return get().sensorHistory.get(roomId) || [];
  },

  setActiveTab: (tab: 'dashboard' | 'kpi') => {
    set({ activeTab: tab });
  },
}));
