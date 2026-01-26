import { useState, useMemo } from 'react';
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
} from 'recharts';
import { useBuildingStore } from '../store/buildingStore';
import { aggregateKPI } from '../utils/kpiUtils';
import '../styles/KPIStatsPanel.css';

export const KPIStatsPanel = ({ onFullscreen, isFullscreen }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('hour');
  const [selectedRoom, setSelectedRoom] = useState('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const { floorPlans, selectedFloor, sensorHistory } = useBuildingStore();

  // Récupère les salles du plan sélectionné
  const currentFloor = floorPlans.find((f) => f.id === selectedFloor);
  const rooms = currentFloor?.rooms || [];

  // Collecte l'historique pour la période sélectionnée
  const { temperatureChartData, presenceBarData } = useMemo(() => {
    // Filtre les données par salle
    let filteredData = [];
    
    if (selectedRoom === 'all') {
      // Toutes les salles - combine les historiques
      for (const history of sensorHistory.values()) {
        filteredData.push(...history);
      }
    } else {
      // Une salle spécifique
      const roomHistory = sensorHistory.get(selectedRoom);
      if (roomHistory) {
        filteredData = roomHistory;
      }
    }

    // Filtre par date sélectionnée
    const selectedDateObj = new Date(selectedDate);
    const dateStart = selectedDateObj.getTime();
    const dateEnd = dateStart + 24 * 60 * 60 * 1000;

    filteredData = filteredData.filter(
      (data) => data.timestamp >= dateStart && data.timestamp < dateEnd
    );

    // Trie par timestamp
    filteredData.sort((a, b) => a.timestamp - b.timestamp);

    // Agrège par période
    const aggregated = aggregateKPI(filteredData, selectedPeriod);
    
    // Crée une map des données agrégées par clé de période
    const aggregatedMap = new Map();
    for (const agg of aggregated) {
      aggregatedMap.set(agg.periodStart, agg);
    }

    // Génère TOUTES les périodes du jour sélectionné
    const allPeriods = [];
    let currentTime = dateStart;
    
    const getPeriodDurationMs = (period) => {
      switch (period) {
        case 'minute': return 60 * 1000;
        case 'hour': return 60 * 60 * 1000;
        case 'day': return 24 * 60 * 60 * 1000;
        case 'week': return 7 * 24 * 60 * 60 * 1000;
        case 'month': return 30 * 24 * 60 * 60 * 1000;
        default: return 60 * 60 * 1000;
      }
    };

    const periodDurationMs = getPeriodDurationMs(selectedPeriod);
    const endTime = selectedPeriod === 'day' || selectedPeriod === 'week' || selectedPeriod === 'month' 
      ? dateEnd 
      : dateEnd;

    while (currentTime < endTime) {
      // Aligne à la période précédente la plus proche
      const periodStart = Math.floor(currentTime / periodDurationMs) * periodDurationMs;
      
      if (aggregatedMap.has(periodStart)) {
        allPeriods.push(aggregatedMap.get(periodStart));
      } else {
        // Crée une période vide
        allPeriods.push({
          periodStart,
          periodEnd: periodStart + periodDurationMs,
          temperature: { min: 0, max: 0, avg: 0 },
          presenceRate: 0,
          count: 0,
        });
      }
      
      currentTime = periodStart + periodDurationMs;
    }

    // Formate pour le graphique température
    const tempData = allPeriods.map((agg) => ({
      time: new Date(agg.periodStart).toLocaleString('fr-FR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      tempMin: parseFloat(agg.temperature.min.toFixed(2)),
      tempMax: parseFloat(agg.temperature.max.toFixed(2)),
      tempAvg: parseFloat(agg.temperature.avg.toFixed(2)),
    }));

    // Formate pour le graphique présence en barres (adapté à la période)
    const barData = allPeriods.map((agg) => ({
      period: new Date(agg.periodStart).toLocaleString('fr-FR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      presenceRate: parseFloat((agg.presenceRate * 100).toFixed(1)),
    }));

    return {
      temperatureChartData: tempData,
      presenceBarData: barData,
    };
  }, [sensorHistory, selectedRoom, selectedPeriod, selectedDate]);

  return (
    <div className="kpi-stats-panel">
      <div className="kpi-header">
        <h2>Statistiques KPI - Température & Présence</h2>
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


      </div>

      {temperatureChartData.length > 0 ? (
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
                <YAxis label={{ value: 'Température (°C)', angle: -90, position: 'insideLeft' }} />
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
            <h3>Taux de Présence - {selectedPeriod === 'minute' ? 'Par Minute' : selectedPeriod === 'hour' ? 'Par Heure' : selectedPeriod === 'day' ? 'Par Jour' : selectedPeriod === 'week' ? 'Par Semaine' : 'Par Mois'}</h3>
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
                  label={{ value: 'Taux (%)', angle: -90, position: 'insideLeft' }}
                  domain={[0, 100]}
                />
                <Tooltip formatter={(value) => `${value}%`} />
                <Bar dataKey="presenceRate" fill="#4CAF50" name="Taux de présence" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Résumé statistiques */}
          <div className="stats-summary">
            <h3>Résumé</h3>
            <div className="summary-items">
              <div className="summary-item">
                <strong>Nombre de périodes:</strong>
                <span>{temperatureChartData.length}</span>
              </div>
              <div className="summary-item">
                <strong>Température Moyenne:</strong>
                <span>
                  {(
                    temperatureChartData.reduce((sum, d) => sum + d.tempAvg, 0) / temperatureChartData.length
                  ).toFixed(2)}
                  °C
                </span>
              </div>
              <div className="summary-item">
                <strong>Température Min Globale:</strong>
                <span>
                  {Math.min(...temperatureChartData.map((d) => d.tempMin)).toFixed(2)}°C
                </span>
              </div>
              <div className="summary-item">
                <strong>Température Max Globale:</strong>
                <span>
                  {Math.max(...temperatureChartData.map((d) => d.tempMax)).toFixed(2)}°C
                </span>
              </div>
              <div className="summary-item">
                <strong>Taux Présence Moyen:</strong>
                <span>
                  {(
                    presenceBarData.reduce((sum, d) => sum + d.presenceRate, 0) /
                    presenceBarData.length
                  ).toFixed(1)}
                  %
                </span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="no-data">
          <p>Aucune donnée disponible. Assurez-vous que les capteurs envoient des données.</p>
        </div>
      )}
    </div>
  );
};
