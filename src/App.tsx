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
        id: 'WC__1',
        name: 'WC_1',
        x: 20,
        y: 7,
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
        y: 9.5,
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
        y: 7,
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
        y: 12,
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
        y: 7,
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
        y: 7,
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
        y: 7,
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
        y: 7,
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
        y: 7,
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
        y: 7,
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
        id: 'WC_2',
        name: 'WC_2',
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
        id: 'Foyer',
        name: 'Foyer',
        x: 0,
        y: 0,
        width: 5,
        height: 5,
        occupied: false,
        temperature: 20,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'Salle_211',
        name: 'Salle 211',
        x: 5,
        y: 0,
        width: 3,
        height: 5,
        occupied: false,
        temperature: 20,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'BDE',
        name: 'BDE',
        x: 8,
        y: 0,
        width: 2,
        height: 4,
        occupied: false,
        temperature: 20,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'WC_1',
        name: 'WC_1',
        x: 11,
        y: 0,
        width: 2,
        height: 4,
        occupied: false,
        temperature: 20,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'Salle_212',
        name: 'Salle 212',
        x: 13,
        y: 0,
        width: 5,
        height: 4,
        occupied: false,
        temperature: 20,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'Salle_213',
        name: 'Salle 213',
        x: 18,
        y: 0,
        width: 5,
        height: 4,
        occupied: false,
        temperature: 20,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'Salle_Info',
        name: 'Salle Info',
        x: 23,
        y: 0,
        width: 5,
        height: 4,
        occupied: false,
        temperature: 20,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'Salle_215',
        name: 'Salle 215',
        x: 28,
        y: 0,
        width: 5,
        height: 4,
        occupied: false,
        temperature: 20,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'Salle_Projet',
        name: 'Salle Projet',
        x: 0,
        y: 7,
        width: 4,
        height: 2.5,
        occupied: false,
        temperature: 20,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'FabLab',
        name: 'FabLab',
        x: 0,
        y: 9.5,
        width: 4,
        height: 2.5,
        occupied: false,
        temperature: 20,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'Salle_208',
        name: 'Salle 208',
        x: 4,
        y: 9,
        width: 4,
        height: 3,
        occupied: false,
        temperature: 20,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'Salle_207',
        name: 'Salle 207',
        x: 8,
        y: 9,
        width: 4.5,
        height: 3,
        occupied: false,
        temperature: 20,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'Salle_206',
        name: 'Salle 206',
        x: 12.5,
        y: 9,
        width: 4.5,
        height: 3,
        occupied: false,
        temperature: 20,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'Salle_205',
        name: 'Salle 205',
        x: 17,
        y: 8,
        width: 2.5,
        height: 4,
        occupied: false,
        temperature: 20,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'LINEACT',
        name: 'LINEACT',
        x: 19.5,
        y: 8,
        width: 2.5,
        height: 4,
        occupied: false,
        temperature: 20,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'WC_2',
        name: 'WC_2',
        x: 23,
        y: 8,
        width: 2.5,
        height: 4,
        occupied: false,
        temperature: 20,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'International',
        name: 'International',
        x: 25.5,
        y: 8.5,
        width: 2.5,
        height: 3.5,
        occupied: false,
        temperature: 20,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'Compta_1',
        name: 'Compta',
        x: 28,
        y: 8.5,
        width: 2.5,
        height: 3.5,
        occupied: false,
        temperature: 20,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'Compta_2',
        name: 'Compta',
        x: 30.5,
        y: 8.5,
        width: 2.5,
        height: 3.5,
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
        <h1>CESI Monitoring System</h1>
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
