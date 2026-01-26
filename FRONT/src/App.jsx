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

// Exemple de données de bâtiment - Mis à jour en fonction des plans d'évacuation


function App() {
  const [mqttConfig, setMqttConfig] = useState(null);
  const [fullscreenMode, setFullscreenMode] = useState(null); // 'kpi' ou 'floorplan' ou null
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
        <h1>Système de Surveillance CESI</h1>
        <ConnectionStatus isConnected={isConnected} error={mqttError || error} />
      </header>

      <TabNavigation />

      {fullscreenMode ? (
        <div className="fullscreen-container">
          <button
            className="fullscreen-close-btn"
            onClick={() => setFullscreenMode(null)}
            title="Quitter le plein écran"
          >
            ×
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
                        <p>Aucun étage sélectionné. Veuillez sélectionner un étage pour voir le plan.</p>
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
            Tableau de Bord de Surveillance du Bâtiment • Dernière mise à jour:{' '}
            {new Date().toLocaleTimeString('fr-FR')}
          </p>
        </footer>
      )}
    </div>
  );
}

export default App;
