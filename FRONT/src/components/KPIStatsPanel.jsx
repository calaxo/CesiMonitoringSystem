import { useState, useMemo, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useBuildingStore } from "../store/buildingStore";
import * as apiService from "../services/apiService";
import "../styles/KPIStatsPanel.css";

export const KPIStatsPanel = ({ onFullscreen, isFullscreen }) => {
  // Récupérer les valeurs sauvegardées ou utiliser les valeurs par défaut
  const [selectedPeriod, setSelectedPeriod] = useState(
    () => localStorage.getItem("kpi_period") || "hour",
  );
  const [selectedRoom, setSelectedRoom] = useState(
    () => localStorage.getItem("kpi_room") || "all",
  );
  const [selectedDate, setSelectedDate] = useState(
    () =>
      localStorage.getItem("kpi_date") ||
      new Date().toISOString().split("T")[0],
  );
  const [historyData, setHistoryData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [sensorsList, setSensorsList] = useState([]);

  const { floorPlans, selectedFloor, globalStats, sensorRegistry } = useBuildingStore();

  // Sauvegarder les sélections dans localStorage
  useEffect(() => {
    localStorage.setItem("kpi_period", selectedPeriod);
  }, [selectedPeriod]);

  useEffect(() => {
    localStorage.setItem("kpi_room", selectedRoom);
  }, [selectedRoom]);

  useEffect(() => {
    localStorage.setItem("kpi_date", selectedDate);
  }, [selectedDate]);

  // Récupère les salles du plan sélectionné
  const currentFloor = floorPlans.find((f) => f.id === selectedFloor);
  const rooms = currentFloor?.rooms || [];

  // Charger la liste des capteurs au montage
  useEffect(() => {
    const loadSensors = async () => {
      try {
        const sensors = await apiService.getAllSensors();
        setSensorsList(sensors);
      } catch (err) {
        console.error("Erreur chargement capteurs:", err);
      }
    };
    loadSensors();
  }, []);

  // Fonction pour trouver le sensor_id correspondant à un room_id
  const getSensorIdForRoom = useCallback((roomId) => {
    // Chercher dans sensorRegistry (mapping local)
    for (const [sensorId, mappedRoomId] of sensorRegistry.entries()) {
      if (mappedRoomId === roomId) {
        return sensorId;
      }
    }
    // Chercher dans la liste des capteurs depuis l'API
    const sensor = sensorsList.find(s => s.location === roomId);
    return sensor?.sensor_id || null;
  }, [sensorRegistry, sensorsList]);

  // Fonction pour charger l'historique (avec useCallback pour éviter les re-créations)
  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      // Calculer les dates de début et fin
      const dateStart = new Date(selectedDate);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(selectedDate);
      dateEnd.setHours(23, 59, 59, 999);

      const options = {
        from: dateStart.toISOString(),
        to: dateEnd.toISOString(),
        limit: 1000, // Récupérer plus de données pour les graphiques
      };

      // Si une salle spécifique est sélectionnée, trouver le sensor_id correspondant
      if (selectedRoom !== "all") {
        const sensorId = getSensorIdForRoom(selectedRoom);
        if (sensorId) {
          options.sensorId = sensorId;
          console.log(`stats: Salle ${selectedRoom} → Capteur ${sensorId}`);
        } else {
          console.warn(`stats: Aucun capteur trouvé pour la salle ${selectedRoom}`);
          // Si pas de capteur trouvé, on ne filtre pas (affiche tout)
        }
      }

      const data = await apiService.getSensorHistory(options);

      // Transformer les données pour le format attendu
      const formattedData = data.map((item) => ({
        temperature:
          typeof item.temperature === "number"
            ? item.temperature
            : parseFloat(item.temperature) || null,
        presence: item.presence,
        timestamp: new Date(item.received_at).getTime(),
        sensorId: item.sensor_id,
      }));

      setHistoryData(formattedData);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Erreur chargement historique:", err);
      setHistoryData([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, selectedRoom, getSensorIdForRoom]);

  // Charger l'historique depuis l'API quand les filtres changent
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Rafraîchissement automatique basé sur la période sélectionnée
  useEffect(() => {
    // Définir l'intervalle de rafraîchissement selon la période
    const getRefreshInterval = () => {
      switch (selectedPeriod) {
        case "minute":
          return 60 * 1000; // 1 minute
        case "hour":
          return 5 * 60 * 1000; // 5 minutes
        case "day":
          return 30 * 60 * 1000; // 30 minutes
        default:
          return 5 * 60 * 1000; // 5 minutes par défaut
      }
    };

    const intervalMs = getRefreshInterval();
    console.log(
      `Auto-refresh stats configuré: toutes les ${intervalMs / 1000}s`,
    );

    const interval = setInterval(() => {
      console.log(`Rafraîchissement auto KPI (${selectedPeriod})`);
      loadHistory();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [selectedPeriod, loadHistory]);

  // Agréger les données par période
  const { temperatureChartData, presenceBarData } = useMemo(() => {
    if (historyData.length === 0) {
      return { temperatureChartData: [], presenceBarData: [] };
    }

    const getPeriodDurationMs = (period) => {
      switch (period) {
        case "minute":
          return 60 * 1000;
        case "hour":
          return 60 * 60 * 1000;
        case "day":
          return 24 * 60 * 60 * 1000;
        case "week":
          return 7 * 24 * 60 * 60 * 1000;
        case "month":
          return 30 * 24 * 60 * 60 * 1000;
        default:
          return 60 * 60 * 1000;
      }
    };

    const periodDurationMs = getPeriodDurationMs(selectedPeriod);

    // Grouper les données par période
    const periodGroups = new Map();

    historyData.forEach((item) => {
      const periodStart =
        Math.floor(item.timestamp / periodDurationMs) * periodDurationMs;

      if (!periodGroups.has(periodStart)) {
        periodGroups.set(periodStart, {
          temperatures: [],
          presences: [],
        });
      }

      const group = periodGroups.get(periodStart);
      if (item.temperature !== null) {
        group.temperatures.push(item.temperature);
      }
      if (item.presence !== null) {
        group.presences.push(item.presence ? 1 : 0);
      }
    });

    // Convertir en tableau et calculer les agrégats
    const aggregated = Array.from(periodGroups.entries())
      .map(([periodStart, group]) => {
        const temps = group.temperatures;
        const presences = group.presences;

        return {
          periodStart,
          temperature: {
            min: temps.length > 0 ? Math.min(...temps) : 0,
            max: temps.length > 0 ? Math.max(...temps) : 0,
            avg:
              temps.length > 0
                ? temps.reduce((a, b) => a + b, 0) / temps.length
                : 0,
          },
          presenceRate:
            presences.length > 0
              ? presences.reduce((a, b) => a + b, 0) / presences.length
              : 0,
          count: temps.length + presences.length,
        };
      })
      .sort((a, b) => a.periodStart - b.periodStart);

    // Formate pour le graphique température
    const tempData = aggregated.map((agg) => ({
      time: new Date(agg.periodStart).toLocaleString("fr-FR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      tempMin: parseFloat(agg.temperature.min.toFixed(2)),
      tempMax: parseFloat(agg.temperature.max.toFixed(2)),
      tempAvg: parseFloat(agg.temperature.avg.toFixed(2)),
    }));

    // Formate pour le graphique présence en barres
    const barData = aggregated.map((agg) => ({
      period: new Date(agg.periodStart).toLocaleString("fr-FR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      presenceRate: parseFloat((agg.presenceRate * 100).toFixed(1)),
    }));

    return {
      temperatureChartData: tempData,
      presenceBarData: barData,
    };
  }, [historyData, selectedPeriod]);

  return (
    <div className="kpi-stats-panel">
      <div className="kpi-header">
        <h2>Statistiques KPI - Température & Présence</h2>
        <div className="kpi-header-right">
          {lastRefresh && (
            <span className="last-refresh">
              Mis à jour: {lastRefresh.toLocaleTimeString("fr-FR")}
            </span>
          )}
          <button
            className="refresh-btn-small"
            onClick={loadHistory}
            disabled={isLoading}
            title="Rafraîchir maintenant"
          >
            🔄
          </button>
          {onFullscreen && !isFullscreen && (
            <button
              className="fullscreen-btn"
              onClick={onFullscreen}
              title="Fullscreen"
            >
              ⛶
            </button>
          )}
        </div>
      </div>

      <div className="kpi-controls">
        <div className="control-group">
          <label htmlFor="period-select">Période:</label>
          <select
            id="period-select"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
          >
            <option value="minute">Par Minute</option>
            <option value="hour">Par Heure</option>
            <option value="day">Par Jour</option>
            <option value="week">Par Semaine</option>
            <option value="month">Par Mois</option>
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="room-select">Salle:</label>
          <select
            id="room-select"
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
          >
            <option value="all">Toutes les salles</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="date-select">Date:</label>
          <input
            id="date-select"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        {isLoading && <span className="loading-text">⏳ Chargement...</span>}
      </div>

      {isLoading ? (
        <div className="loading-container">
          <p>Chargement des données historiques...</p>
        </div>
      ) : temperatureChartData.length > 0 ? (
        <>
          {/* Graphique température */}
          <div className="chart-container">
            <h3>Courbe de Température (°C)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={temperatureChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  label={{
                    value: "Température (°C)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="tempMin"
                  stroke="#0088fe"
                  name="Temp Min"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="tempAvg"
                  stroke="#ff7300"
                  name="Temp Moyenne"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="tempMax"
                  stroke="#82ca9d"
                  name="Temp Max"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Graphique présence en barres (adapté à la période) */}
          <div className="chart-container">
            <h3>
              Taux de Présence -{" "}
              {selectedPeriod === "minute"
                ? "Par Minute"
                : selectedPeriod === "hour"
                  ? "Par Heure"
                  : selectedPeriod === "day"
                    ? "Par Jour"
                    : selectedPeriod === "week"
                      ? "Par Semaine"
                      : "Par Mois"}
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={presenceBarData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  label={{
                    value: "Taux (%)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                  domain={[0, 100]}
                />
                <Tooltip formatter={(value) => `${value}%`} />
                <Bar
                  dataKey="presenceRate"
                  fill="#4CAF50"
                  name="Taux de présence"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Résumé statistiques */}
          <div className="stats-summary">
            <h3>Résumé (Session actuelle)</h3>
            <div className="summary-items">
              <div className="summary-item">
                <strong>Nombre de périodes:</strong>
                <span>{temperatureChartData.length}</span>
              </div>
              <div className="summary-item">
                <strong>Température Moyenne:</strong>
                <span>
                  {(
                    temperatureChartData.reduce(
                      (sum, d) => sum + d.tempAvg,
                      0,
                    ) / temperatureChartData.length
                  ).toFixed(2)}
                  °C
                </span>
              </div>
              <div className="summary-item">
                <strong>Température Min Globale:</strong>
                <span>
                  {Math.min(
                    ...temperatureChartData.map((d) => d.tempMin),
                  ).toFixed(2)}
                  °C
                </span>
              </div>
              <div className="summary-item">
                <strong>Température Max Globale:</strong>
                <span>
                  {Math.max(
                    ...temperatureChartData.map((d) => d.tempMax),
                  ).toFixed(2)}
                  °C
                </span>
              </div>
              <div className="summary-item">
                <strong>Taux Présence Moyen:</strong>
                <span>
                  {(
                    presenceBarData.reduce(
                      (sum, d) => sum + d.presenceRate,
                      0,
                    ) / presenceBarData.length
                  ).toFixed(1)}
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Statistiques Base de Données */}
          {globalStats && (
            <div className="stats-summary database-stats">
              <h3>📊 Statistiques Base de Données</h3>
              <div className="summary-items">
                <div className="summary-item">
                  <strong>Capteurs enregistrés:</strong>
                  <span className="stat-value">
                    {globalStats.uniqueSensors || 0}
                  </span>
                </div>
                <div className="summary-item">
                  <strong>Total messages reçus:</strong>
                  <span className="stat-value">
                    {globalStats.totalMessages?.toLocaleString() || 0}
                  </span>
                </div>
                <div className="summary-item">
                  <strong>Relevés température:</strong>
                  <span className="stat-value">
                    {globalStats.temperatureReadings?.toLocaleString() || 0}
                  </span>
                </div>
                <div className="summary-item">
                  <strong>Relevés présence:</strong>
                  <span className="stat-value">
                    {globalStats.presenceReadings?.toLocaleString() || 0}
                  </span>
                </div>
                <div className="summary-item">
                  <strong>Température moyenne (BDD):</strong>
                  <span className="stat-value">
                    {globalStats.avgTemperature || "N/A"}°C
                  </span>
                </div>
                <div className="summary-item">
                  <strong>Salles actuellement occupées:</strong>
                  <span className="stat-value highlight">
                    {globalStats.activePresenceCount || 0}
                  </span>
                </div>
                {globalStats.lastMessageAt && (
                  <div className="summary-item">
                    <strong>Dernier message:</strong>
                    <span className="stat-value">
                      {new Date(globalStats.lastMessageAt).toLocaleString(
                        "fr-FR",
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="no-data">
          <p>
            Aucune donnée disponible. Assurez-vous que les capteurs envoient des
            données.
          </p>
        </div>
      )}
    </div>
  );
};
