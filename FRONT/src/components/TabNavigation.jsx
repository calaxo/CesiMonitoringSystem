import { useBuildingStore } from "../store/buildingStore";
import "../styles/TabNavigation.css";

export const TabNavigation = () => {
  const { activeTab, setActiveTab } = useBuildingStore();

  return (
    <div className="tab-navigation">
      <button
        className={`tab-button ${activeTab === "dashboard" ? "active" : ""}`}
        onClick={() => setActiveTab("dashboard")}
      >
        Tableau de Bord
      </button>
      <button
        className={`tab-button ${activeTab === "kpi" ? "active" : ""}`}
        onClick={() => setActiveTab("kpi")}
      >
        Statistiques KPI
      </button>
      <button
        className={`tab-button ${activeTab === "sensors" ? "active" : ""}`}
        onClick={() => setActiveTab("sensors")}
      >
        Configuration Capteurs
      </button>
      <button
        className={`tab-button ${activeTab === "simulation" ? "active" : ""}`}
        onClick={() => setActiveTab("simulation")}
      >
        Simulation
      </button>
    </div>
  );
};
