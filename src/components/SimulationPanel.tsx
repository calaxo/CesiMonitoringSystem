import { useState, useEffect } from 'react';
import { useBuildingStore } from '../store/buildingStore';
import '../styles/SimulationPanel.css';

export function SimulationPanel() {
  const { floorPlans, updateSensorData, clearSensorData } = useBuildingStore();
  const [isRunning, setIsRunning] = useState(false);

  const simulateRandomData = () => {
    // Parcourir tous les étages et toutes les salles
    floorPlans.forEach((floor) => {
      floor.rooms.forEach((room) => {
        // Générer des données aléatoires
        const occupied = Math.random() > 0.5; // 50% chance d'être occupé
        const temperature = 18 + Math.random() * 8; // Entre 18 et 26°C

        // Mettre à jour le store avec les nouvelles données
        updateSensorData(room.id, {
          roomId: room.id,
          occupied,
          temperature: Math.round(temperature * 10) / 10, // Arrondir à 1 décimale
          timestamp: Date.now(),
        });
      });
    });
  };

  // Mise à jour en temps réel quand la simulation est active
  useEffect(() => {
    if (!isRunning) {
      // Réinitialiser les données quand on arrête
      clearSensorData();
      return;
    }

    // Mettre à jour immédiatement
    simulateRandomData();

    // Puis mettre à jour toutes les 2 secondes
    const interval = setInterval(() => {
      simulateRandomData();
    }, 2000);

    return () => clearInterval(interval);
  }, [isRunning, floorPlans]);

  const toggleSimulation = () => {
    setIsRunning(!isRunning);
  };

  const handleStartOnce = () => {
    simulateRandomData();
  };

  return (
    <div className="simulation-panel">
      <h3>Simulation des Capteurs</h3>
      <div className="simulation-controls">
        <button
          className={`simulation-btn ${isRunning ? 'active' : ''}`}
          onClick={toggleSimulation}
        >
          {isRunning ? '⏸ Arrêter Simulation' : '▶ Démarrer Simulation'}
        </button>
        <button className="simulation-btn simulate-once" onClick={handleStartOnce}>
          🎲 Simuler Une Fois
        </button>
      </div>
      <p className="simulation-status">
        {isRunning ? '🟢 Simulation active' : '⚫ Simulation arrêtée'}
      </p>
    </div>
  );
}
