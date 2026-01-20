import { useState, useEffect } from 'react';
import type { MQTTConfig, FloorPlan } from './types';
import { useBuildingStore } from './store/buildingStore';
import { useMQTT } from './hooks/useMQTT';
import { MQTTConfigPanel } from './components/MQTTConfigPanel';
import { BuildingFloorPlan } from './components/BuildingFloorPlan';
import { FloorSelector } from './components/FloorSelector';
import { RoomDetails } from './components/RoomDetails';
import { ConnectionStatus } from './components/ConnectionStatus';
import './App.css';

// Sample building data - Updated based on evacuation plans
const SAMPLE_BUILDING: FloorPlan[] = [
  {
    id: 'floor0',
    name: 'Ground Floor (Niveau 0)',
    width: 200,
    height: 250,
    rooms: [
      {
        id: 'WC_1',
        name: 'WC',
        x: 20,
        y: 8,
        width: 2,
               height: 5,
        occupied: true,
        temperature: 21,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'Salle_Reunion',
        name: 'Salle Réunion', 
        x: 22,
        y: 10.5,
        width: 6,
        height: 2.5,
        occupied: true,
        temperature: 21,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'Salle_Accueil',
        name: 'Accueil', 
        x: 22,
        y: 8,
        width: 6,
        height: 2.5,
        occupied: true,
        temperature: 21,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'Salle_Conference',
        name: 'Salle Conférence',
        x: 19,
        y: 13,
        width: 6,
        height: 5,
        occupied: true,
        temperature: 21,
        lastUpdate: new Date().toISOString(),
      },     
      {
        id: 'Salle_101',
        name: 'Salle 101',
        x: 15,
        y: 8,
        width: 3,
        height: 5,
        occupied: true,
        temperature: 21,
        lastUpdate: new Date().toISOString(),
      },  
      {
        id: 'Salle_102',
        name: 'Salle 102',
        x: 12,
        y: 8,
        width: 3,
        height: 5,
        occupied: true,
        temperature: 21,
        lastUpdate: new Date().toISOString(),
      },  
      {
        id: 'Salle_103',
        name: 'Salle 103',
        x: 9,
        y: 8,
        width: 3,
        height: 5,
        occupied: true,
        temperature: 21,
        lastUpdate: new Date().toISOString(),
      }, 
      {
        id: 'Salle_104',
        name: 'Salle 104',
        x: 6,
        y: 8,
        width: 3,
        height: 5,
        occupied: true,
        temperature: 21,
        lastUpdate: new Date().toISOString(),
      },  
      {
        id: 'Salle_105',
        name: 'Salle 105',
        x: 3,
        y: 8,
        width: 3,
        height: 5,
        occupied: true,
        temperature: 21,
        lastUpdate: new Date().toISOString(),
      },  
      {
        id: 'Salle_106',
        name: 'Salle 106',
        x: 0,
        y: 8,
        width: 3,
        height: 5,
        occupied: true,
        temperature: 21,
        lastUpdate: new Date().toISOString(),
      }, 
      {
        id: 'Salle_107',
        name: 'Salle 107',
        x: 0,
        y: 0,
        width: 3,
        height: 5,
        occupied: true,
        temperature: 21,
        lastUpdate: new Date().toISOString(),
      },  
      {
        id: 'Salle_108',
        name: 'Salle 108',
        x: 3,
        y: 0,
        width: 3,
        height: 5,
        occupied: true,
        temperature: 21,
        lastUpdate: new Date().toISOString(),
      },  
      {
        id: 'Salle_109',
        name: 'Salle 109',
        x: 6,
        y: 0,
        width: 3,
        height: 5,
        occupied: true,
        temperature: 21,
        lastUpdate: new Date().toISOString(),
      }, 
      {
        id: 'WC',
        name: 'WC',
        x: 10,
        y: 0,
        width: 2,
               height: 5,
        occupied: true,
        temperature: 21,
        lastUpdate: new Date().toISOString(),
      }, 
      {
        id: 'Salle_110',
        name: 'Salle 110',
        x: 12,
        y: 0,
        width: 3,
        height: 5,
        occupied: true,
        temperature: 21,
        lastUpdate: new Date().toISOString(),
      },  
      {
        id: 'Salle_111',
        name: 'Salle 111',
        x: 15,
        y: 0,
        width: 3,
        height: 5,
        occupied: true,
        temperature: 21,
        lastUpdate: new Date().toISOString(),
      },  
      {
        id: 'Salle_112',
        name: 'Salle 112',
        x: 19,
        y: 0,
        width: 3,
        height: 5,
        occupied: true,
        temperature: 21,
        lastUpdate: new Date().toISOString(),
      }, 
      {
        id: 'Salle_113',
        name: 'Salle 113',
        x: 22,
        y: 0,
        width: 3,
        height: 5,
        occupied: true,
        temperature: 21,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'Salles_Technique',
        name: 'Salles Technique', 
        x: 25,
        y: 0,
        width: 6,
               height: 5,
        occupied: true,
        temperature: 21,
        lastUpdate: new Date().toISOString(),
      }, 

    ],
  },
  {
    id: 'floor1',
    name: 'First Floor (Niveau 1)',
    width: 200,
    height: 200,
    rooms: [
      {
        id: 'room_foyer',
        name: 'Foyer',
        x: 0,
        y: 0,
        width: 4,
        height: 3,
        occupied: false,
        temperature: 20,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'room_reunion1',
        name: 'Salle réunion',
        x: 5,
        y: 0,
        width: 4,
        height: 3,
        occupied: true,
        temperature: 21,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'room_bde',
        name: 'BDE',
        x: 10,
        y: 0,
        width: 3,
        height: 3,
        occupied: false,
        temperature: 19,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'room_242',
        name: 'Salle 242',
        x: 0,
        y: 4,
        width: 3,
        height: 3,
        occupied: true,
        temperature: 22,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'room_243',
        name: 'Salle 243',
        x: 4,
        y: 4,
        width: 3,
        height: 3,
        occupied: true,
        temperature: 23,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'room_informatique',
        name: 'Salle informatique',
        x: 8,
        y: 4,
        width: 3,
        height: 3,
        occupied: false,
        temperature: 24,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'room_245',
        name: 'Salle 245',
        x: 12,
        y: 4,
        width: 3,
        height: 3,
        occupied: false,
        temperature: 20,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'room_project',
        name: 'Salle Projet',
        x: 0,
        y: 8,
        width: 3,
        height: 3,
        occupied: true,
        temperature: 21,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'room_fab_lab',
        name: 'FAB\'LAB',
        x: 4,
        y: 8,
        width: 4,
        height: 3,
        occupied: true,
        temperature: 22,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'room_208',
        name: 'Salle 208',
        x: 9,
        y: 8,
        width: 3,
        height: 3,
        occupied: false,
        temperature: 20,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'room_209',
        name: 'Salle 209',
        x: 0,
        y: 12,
        width: 3,
        height: 3,
        occupied: false,
        temperature: 19,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'room_206',
        name: 'Salle 206',
        x: 4,
        y: 12,
        width: 3,
        height: 3,
        occupied: true,
        temperature: 21,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'room_205',
        name: 'Salle 205',
        x: 8,
        y: 12,
        width: 3,
        height: 3,
        occupied: false,
        temperature: 20,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'room_archive',
        name: 'Archives',
        x: 9,
        y: 4,
        width: 2,
        height: 3,
        occupied: false,
        temperature: 18,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'room_bureau_redaction',
        name: 'Bureau rédaction',
        x: 9,
        y: 8,
        width: 2,
        height: 3,
        occupied: true,
        temperature: 21,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'room_atelier_materiaux',
        name: 'Atelier matériaux',
        x: 12,
        y: 8,
        width: 3,
        height: 3,
        occupied: true,
        temperature: 23,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'room_bureau_compta',
        name: 'Bureau compta',
        x: 12,
        y: 12,
        width: 3,
        height: 3,
        occupied: false,
        temperature: 20,
        lastUpdate: new Date().toISOString(),
      },
    ],
  },
];

function App() {
  const [mqttConfig, setMqttConfig] = useState<MQTTConfig | null>(null);
  const {
    floorPlans,
    selectedFloor,
    sensorData,
    isConnected,
    error,
    setFloorPlans,
    setSelectedFloor,
  } = useBuildingStore();

  const { isConnecting, error: mqttError } = useMQTT(mqttConfig);

  // Initialize floor plans on mount
  useEffect(() => {
    setFloorPlans(SAMPLE_BUILDING);
  }, [setFloorPlans]);

  const handleConnect = (config: MQTTConfig) => {
    setMqttConfig(config);
  };

  const handleFloorSelect = (floorId: string) => {
    setSelectedFloor(floorId);
  };

  const currentFloor = floorPlans.find((f) => f.id === selectedFloor);
  const currentRooms = currentFloor?.rooms || [];

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🏢 Building Monitoring System</h1>
        <ConnectionStatus isConnected={isConnected} error={mqttError || error} />
      </header>

      <div className="app-content">
        <aside className="sidebar">
          <MQTTConfigPanel
            onConnect={handleConnect}
            isConnecting={isConnecting}
            error={mqttError}
          />
          <FloorSelector
            floors={floorPlans}
            selectedFloorId={selectedFloor}
            onSelectFloor={handleFloorSelect}
          />
          <RoomDetails rooms={currentRooms} sensorData={sensorData} />
        </aside>

        <main className="main-content">
          {currentFloor ? (
            <BuildingFloorPlan
              rooms={currentRooms}
              sensorData={sensorData}
              floorName={currentFloor.name}
            />
          ) : (
            <div className="no-floor">
              <p>No floor selected. Please select a floor to view.</p>
            </div>
          )}
        </main>
      </div>

      <footer className="app-footer">
        <p>
          Building Monitoring Dashboard • Last Update:{' '}
          {new Date().toLocaleTimeString()}
        </p>
      </footer>
    </div>
  );
}

export default App;
