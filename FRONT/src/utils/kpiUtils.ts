// Fonctions utilitaires pour calculer les KPI de température et de présence
import type { SensorData } from '../types';

export type TimePeriod = 'minute' | 'hour' | 'day' | 'week' | 'month';

export interface AggregatedKPI {
  periodStart: number; // timestamp du début de la période
  periodEnd: number;   // timestamp de fin de période
  temperature: {
    min: number;
    max: number;
    avg: number;
  };
  presenceRate: number; // taux de présence (0-1)
  count: number; // nombre de mesures
}

// Regroupe les données par période (ex: minute, heure, etc.)
export function groupSensorDataByPeriod(
  data: SensorData[],
  period: TimePeriod
): Map<number, SensorData[]> {
  const grouped = new Map<number, SensorData[]>();
  for (const d of data) {
    const key = getPeriodKey(d.timestamp, period);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(d);
  }
  return grouped;
}

// Calcule la clé de période (timestamp arrondi à la période)
export function getPeriodKey(timestamp: number, period: TimePeriod): number {
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

// Calcule les KPI pour chaque période
export function aggregateKPI(
  data: SensorData[],
  period: TimePeriod
): AggregatedKPI[] {
  const grouped = groupSensorDataByPeriod(data, period);
  const result: AggregatedKPI[] = [];
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
      presenceRate: pres.reduce((a: number, b: number) => a + b, 0) / pres.length,
      count: group.length,
    });
  }
  return result;
}

// Durée en ms d'une période
export function getPeriodDuration(period: TimePeriod): number {
  switch (period) {
    case 'minute': return 60 * 1000;
    case 'hour': return 60 * 60 * 1000;
    case 'day': return 24 * 60 * 60 * 1000;
    case 'week': return 7 * 24 * 60 * 60 * 1000;
    case 'month': return 31 * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}
