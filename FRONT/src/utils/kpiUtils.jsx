// Fonctions utilitaires pour calculer les KPI de température et de présence

// Regroupe les données par période (ex: minute, heure, etc.)
export function groupSensorDataByPeriod(data, period) {
  const grouped = new Map();
  for (const d of data) {
    const key = getPeriodKey(d.timestamp, period);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(d);
  }
  return grouped;
}

// Calcule la clé de période (timestamp arrondi à la période)
export function getPeriodKey(timestamp, period) {
  const date = new Date(timestamp);
  switch (period) {
    case 'minute':
      date.setSeconds(0, 0);
      break;
    case 'hour':
      date.setMinutes(0, 0, 0);
      break;
    case 'day':
      date.setHours(0, 0, 0, 0);
      break;
    case 'week': {
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Lundi = 1
      date.setDate(diff);
      date.setHours(0, 0, 0, 0);
      break;
    }
    case 'month':
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      break;
  }
  return date.getTime();
}

// Calcule les stats pour chaque période
export function aggregateKPI(data, period) {
  const grouped = groupSensorDataByPeriod(data, period);
  const result = [];
  for (const [key, group] of grouped.entries()) {
    const temps = group.map(d => d.temperature);
    const pres = group.map(d => d.occupied ? 1 : 0);
    result.push({
      periodStart: key,
      periodEnd: key + getPeriodDuration(period) - 1,
      temperature: {
        min: Math.min(...temps),
        max: Math.max(...temps),
        avg: temps.reduce((a, b) => a + b, 0) / temps.length,
      },
      presenceRate: pres.reduce((a, b) => a + b, 0) / pres.length,
      count: group.length,
    });
  }
  return result;
}

// Durée en ms d'une période
export function getPeriodDuration(period) {
  switch (period) {
    case 'minute': return 60 * 1000;
    case 'hour': return 60 * 60 * 1000;
    case 'day': return 24 * 60 * 60 * 1000;
    case 'week': return 7 * 24 * 60 * 60 * 1000;
    case 'month': return 31 * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}
