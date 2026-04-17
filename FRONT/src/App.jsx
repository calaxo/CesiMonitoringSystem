import { useState, useEffect } from "react";
import { useBuildingStore } from "./store/buildingStore";
import { useApiData } from "./hooks/useApiData";
import { BuildingFloorPlan } from "./components/BuildingFloorPlan";
import { RoomDetails } from "./components/RoomDetails";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { SimulationPanel } from "./components/SimulationPanel";
import { KPIStatsPanel } from "./components/KPIStatsPanel";
import { TabNavigation } from "./components/TabNavigation";
import { SensorMappingPanel } from "./components/SensorMappingPanel";
import "./App.css";

import SAMPLE_BUILDING from "./data/salle";

// Exemple de données de bâtiment - Mis à jour en fonction des plans d'évacuation

function App() {
  const [fullscreenMode, setFullscreenMode] = useState(null); // 'kpi' ou 'floorplan' ou null
  const {
    floorPlans,
    selectedFloor,
    sensorData,
    isConnected,
    isApiConnected,
    error,
    isLoading,
    setFloorPlans,
    setSelectedFloor,
  } = useBuildingStore();

  // Hook pour charger les données depuis l'API
  // Polling activé pour rafraîchir les données périodiquement
  const {
    isLoading: isApiLoading,
    error: apiError,
    refresh: refreshApiData,
    checkServerHealth,
  } = useApiData({
    autoLoad: true, // Charger automatiquement au démarrage
    pollingInterval: 10000, // Rafraîchir toutes les 10 secondes (en ms)
  });

  // Initialize floor plans on mount
  useEffect(() => {
    setFloorPlans(SAMPLE_BUILDING);
  }, [setFloorPlans]);

  // Vérifier la santé du serveur au chargement
  useEffect(() => {
    checkServerHealth();
  }, [checkServerHealth]);

  const handleFloorSelect = (floorId) => {
    setSelectedFloor(floorId);
  };

  const currentFloor = floorPlans.find((f) => f.id === selectedFloor);
  const currentRooms = currentFloor?.rooms || [];
  const activeTab = useBuildingStore((state) => state.activeTab);

  // Combiner les erreurs
  const displayError = apiError || error;

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Système de Surveillance CESI</h1>
        <div className="header-status">
          <ConnectionStatus
            isConnected={isConnected}
            isApiConnected={isApiConnected}
            error={displayError}
          />
          {(isLoading || isApiLoading) && (
            <span className="loading-indicator">Chargement...</span>
          )}
          <button
            className="refresh-btn"
            onClick={refreshApiData}
            disabled={isApiLoading}
            title="Rafraîchir les données"
          >
            Actualiser
          </button>
        </div>
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
          {fullscreenMode === "floorplan" && currentFloor ? (
            <BuildingFloorPlan
              rooms={currentRooms}
              sensorData={sensorData}
              floorName={currentFloor.name}
              isFullscreen={true}
            />
          ) : fullscreenMode === "roomdetails" ? (
            <RoomDetails
              rooms={floorPlans.flatMap((f) => f.rooms)}
              sensorData={sensorData}
              isFullscreen={true}
            />
          ) : (
            <KPIStatsPanel isFullscreen={true} />
          )}
        </div>
      ) : (
        <div className="app-content">
          {activeTab === "dashboard" && (
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
                        onFullscreen={() => setFullscreenMode("floorplan")}
                        floors={floorPlans}
                        selectedFloorId={selectedFloor}
                        onSelectFloor={handleFloorSelect}
                      />
                    ) : (
                      <div className="no-floor">
                        <p>
                          Aucun étage sélectionné. Veuillez sélectionner un
                          étage pour voir le plan.
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Room details section */}
                <section className="room-details-section">
                  <RoomDetails
                    rooms={currentRooms}
                    sensorData={sensorData}
                    onFullscreen={() => setFullscreenMode("roomdetails")}
                  />
                </section>
              </div>
            </main>
          )}

          {activeTab === "kpi" && (
            <main className="main-content-full">
              <KPIStatsPanel onFullscreen={() => setFullscreenMode("kpi")} />
            </main>
          )}

          {activeTab === "sensors" && (
            <main className="main-content-full">
              <SensorMappingPanel />
            </main>
          )}

          {activeTab === "simulation" && (
            <main className="main-content-full">
              <SimulationPanel />
            </main>
          )}
        </div>
      )}

      {!fullscreenMode && (
        <footer className="app-footer">
          <p>
            Tableau de Bord de Surveillance du Bâtiment • Dernière mise à jour:{" "}
            {new Date().toLocaleTimeString("fr-FR")}
          </p>
        </footer>
      )}
    </div>
  );
}

export default App;
