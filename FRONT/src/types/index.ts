export interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  occupied: boolean;
  temperature: number;
  humidity?: number;
  lastUpdate: string;
}

export interface FloorPlan {
  id: string;
  name: string;
  width: number;
  height: number;
  rooms: Room[];
}

export interface MQTTConfig {
  brokerUrl: string;
  clientId: string;
  username?: string;
  password?: string;
  port?: number;
}

export interface SensorData {
  roomId: string;
  occupied: boolean;
  temperature: number;
  humidity?: number;
  timestamp: number;
}

export interface BuildingState {
  floorPlans: FloorPlan[];
  selectedFloor: string | null;
  sensorData: Map<string, SensorData>;
  sensorHistory: Map<string, SensorData[]>;
  isConnected: boolean;
  error: string | null;
  activeTab: 'dashboard' | 'kpi';
}
