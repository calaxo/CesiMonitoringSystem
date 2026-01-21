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
}

export const useBuildingStore = create<BuildingStore>((set, get) => ({
  floorPlans: [],
  selectedFloor: localStorage.getItem('selectedFloor') || null,
  sensorData: new Map(),
  isConnected: false,
  error: null,

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
    set({ sensorData: newData });
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
    set({ sensorData: new Map() });
  },
}));
