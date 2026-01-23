import { useState, useEffect } from 'react';
import { useBuildingStore } from './store/buildingStore';
import { useMQTT } from './hooks/useMQTT';
import { MQTTConfigPanel } from './components/MQTTConfigPanel';
import { BuildingFloorPlan } from './components/BuildingFloorPlan';
import { FloorSelector } from './components/FloorSelector';
import { RoomDetails } from './components/RoomDetails';
import { ConnectionStatus } from './components/ConnectionStatus';
import { SimulationPanel } from './components/SimulationPanel';
import { KPIStatsPanel } from './components/KPIStatsPanel';
import { TabNavigation } from './components/TabNavigation';
import './App.css';

import SAMPLE_BUILDING from './data/salle';

// Sample building data - Updated based on evacuation plans


function App() {
  const [mqttConfig, setMqttConfig] = useState(null);
  const [fullscreenMode, setFullscreenMode] = useState(null); // 'kpi' or 'floorplan' or null
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

  const handleConnect = (config) => {
    setMqttConfig(config);
  };

  const handleFloorSelect = (floorId) => {
    setSelectedFloor(floorId);
  };

  const currentFloor = floorPlans.find((f) => f.id === selectedFloor);
  const currentRooms = currentFloor?.rooms || [];
  const activeTab = useBuildingStore((state) => state.activeTab);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>CESI Monitoring System</h1>
        <ConnectionStatus isConnected={isConnected} error={mqttError || error} />
      </header>

      <TabNavigation />

      {fullscreenMode ? (
        <div className="fullscreen-container">
          <button
            className="fullscreen-close-btn"
            onClick={() => setFullscreenMode(null)}
            title="Exit fullscreen"
          >
            ✕
          </button>
          {fullscreenMode === 'floorplan' && currentFloor ? (
            <BuildingFloorPlan
              rooms={currentRooms}
              sensorData={sensorData}
              floorName={currentFloor.name}
              isFullscreen={true}
            />
          ) : (
            <KPIStatsPanel isFullscreen={true} />
          )}
        </div>
      ) : (
        <div className="app-content">
          <aside className="sidebar">
            <MQTTConfigPanel
              onConnect={handleConnect}
              isConnecting={isConnecting}
              error={mqttError}
            />
            <SimulationPanel />
          </aside>

          {activeTab === 'dashboard' && (
            <main className="main-content-dashboard">
              <div className="dashboard-layout">
                {/* Etage section */}
                <section className="etage-section">
                  <div className="etage-content">
                    {currentFloor ? (
                      <BuildingFloorPlan
                        rooms={currentRooms}
                        sensorData={sensorData}
                        floorName={currentFloor.name}
                        onFullscreen={() => setFullscreenMode('floorplan')}
                        floors={floorPlans}
                        selectedFloorId={selectedFloor}
                        onSelectFloor={handleFloorSelect}
                      />
                    ) : (
                      <div className="no-floor">
                        <p>No floor selected. Please select a floor to view.</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Room details section */}
                <section className="room-details-section">
                  <RoomDetails rooms={currentRooms} sensorData={sensorData} />
                </section>
              </div>
            </main>
          )}

          {activeTab === 'kpi' && (
            <main className="main-content-full">
              <KPIStatsPanel onFullscreen={() => setFullscreenMode('kpi')} />
            </main>
          )}
        </div>
      )}

      {!fullscreenMode && (
        <footer className="app-footer">
          <p>
            Building Monitoring Dashboard • Last Update:{' '}
            {new Date().toLocaleTimeString()}
          </p>
        </footer>
      )}
    </div>
  );
}

export default App;
