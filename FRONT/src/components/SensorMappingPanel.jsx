import { useState, useEffect } from "react";
import * as apiService from "../services/apiService";
import { useBuildingStore } from "../store/buildingStore";
import "../styles/SensorMappingPanel.css";

/**
 * Panel pour mapper les capteurs aux salles du bâtiment
 * Permet d'associer chaque sensor_id à une salle du plan
 */
export const SensorMappingPanel = () => {
  const [sensors, setSensors] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingSensor, setEditingSensor] = useState(null);
  const [saveStatus, setSaveStatus] = useState({});

  const { floorPlans, registerSensor } = useBuildingStore();

  // Récupérer toutes les salles de tous les étages
  const allRooms = floorPlans.flatMap((floor) =>
    (floor.rooms || []).map((room) => ({
      ...room,
      floorId: floor.id,
      floorName: floor.name,
    })),
  );

  // Charger les capteurs au mount
  useEffect(() => {
    loadSensors();
  }, []);

  const loadSensors = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const sensorList = await apiService.getAllSensors();
      setSensors(sensorList);

      // Enregistrer les mappings existants
      sensorList.forEach((sensor) => {
        if (sensor.location) {
          registerSensor(sensor.sensor_id, sensor.location);
        }
      });
    } catch (err) {
      setError("Erreur lors du chargement des capteurs: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationChange = async (sensorId, newLocation) => {
    setSaveStatus({ ...saveStatus, [sensorId]: "saving" });

    try {
      await apiService.updateSensor(sensorId, {
        location: newLocation,
        name: sensors.find((s) => s.sensor_id === sensorId)?.name,
      });

      // Mettre à jour le registre local
      registerSensor(sensorId, newLocation);

      // Mettre à jour l'état local
      setSensors(
        sensors.map((s) =>
          s.sensor_id === sensorId ? { ...s, location: newLocation } : s,
        ),
      );

      setSaveStatus({ ...saveStatus, [sensorId]: "saved" });
      setTimeout(() => {
        setSaveStatus({ ...saveStatus, [sensorId]: null });
      }, 2000);
    } catch (err) {
      setSaveStatus({ ...saveStatus, [sensorId]: "error" });
      setError("Erreur lors de la sauvegarde: " + err.message);
    }
  };

  const handleNameChange = async (sensorId, newName) => {
    const sensor = sensors.find((s) => s.sensor_id === sensorId);
    if (!sensor) return;

    setSaveStatus({ ...saveStatus, [sensorId]: "saving" });

    try {
      await apiService.updateSensor(sensorId, {
        name: newName,
        location: sensor.location,
      });

      setSensors(
        sensors.map((s) =>
          s.sensor_id === sensorId ? { ...s, name: newName } : s,
        ),
      );

      setSaveStatus({ ...saveStatus, [sensorId]: "saved" });
      setEditingSensor(null);
      setTimeout(() => {
        setSaveStatus({ ...saveStatus, [sensorId]: null });
      }, 2000);
    } catch (err) {
      setSaveStatus({ ...saveStatus, [sensorId]: "error" });
    }
  };

  const getSaveStatusIcon = (sensorId) => {
    switch (saveStatus[sensorId]) {
      case "saving":
        return "⏳";
      case "saved":
        return "✅";
      case "error":
        return "❌";
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="sensor-mapping-panel">
        <h3>Configuration des Capteurs</h3>
        <p className="loading">Chargement des capteurs...</p>
      </div>
    );
  }

  return (
    <div className="sensor-mapping-panel">
      <div className="panel-header">
        <h3>🔗 Configuration des Capteurs</h3>
        <button
          className="refresh-btn"
          onClick={loadSensors}
          title="Rafraîchir"
        >
          🔄
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {sensors.length === 0 ? (
        <p className="no-sensors">
          Aucun capteur enregistré. Les capteurs apparaîtront ici une fois
          qu'ils auront envoyé des données.
        </p>
      ) : (
        <div className="sensors-list">
          <table>
            <thead>
              <tr>
                <th>ID Capteur</th>
                <th>Nom</th>
                <th>Salle associée</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sensors.map((sensor) => (
                <tr key={sensor.sensor_id}>
                  <td className="sensor-id">{sensor.sensor_id}</td>
                  <td>
                    {editingSensor === sensor.sensor_id ? (
                      <input
                        type="text"
                        defaultValue={sensor.name || ""}
                        placeholder="Nom du capteur"
                        onBlur={(e) =>
                          handleNameChange(sensor.sensor_id, e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleNameChange(sensor.sensor_id, e.target.value);
                          }
                          if (e.key === "Escape") {
                            setEditingSensor(null);
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <span
                        className="editable-name"
                        onClick={() => setEditingSensor(sensor.sensor_id)}
                        title="Cliquer pour modifier"
                      >
                        {sensor.name || <em>Non défini</em>}
                      </span>
                    )}
                  </td>
                  <td>
                    <select
                      value={sensor.location || ""}
                      onChange={(e) =>
                        handleLocationChange(sensor.sensor_id, e.target.value)
                      }
                    >
                      <option value="">-- Sélectionner une salle --</option>
                      {floorPlans.map((floor) => (
                        <optgroup key={floor.id} label={floor.name}>
                          {(floor.rooms || []).map((room) => (
                            <option key={room.id} value={room.id}>
                              {room.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </td>
                  <td className="status-cell">
                    {getSaveStatusIcon(sensor.sensor_id)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="help-text">
        <p>
          💡 Associez chaque capteur à une salle pour voir ses données sur le
          plan du bâtiment.
        </p>
      </div>
    </div>
  );
};

export default SensorMappingPanel;
