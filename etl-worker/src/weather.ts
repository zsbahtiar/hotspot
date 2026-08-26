// VisualCrossing "timeline" weather client (current conditions), mirroring
// WeatherService. Returns one weather row per unique coordinate. If no API key
// is configured the ETL skips weather (see note in index.ts / README).

import { log } from "./log";

export interface WeatherRow {
  latitude: string;
  longitude: string;
  datetime: string; // "YYYY-MM-DD HH:MM:SS.SSS"
  temperature: number;
  humidity: number;
  wind_speed: number;
  wind_degree: number;
  visibility: number;
  cloud_coverage: number;
  pressure: number;
  uv_index: number;
  precipitation: number;
  solar_radiation: number;
  conditions: string;
  icon: string;
}

export interface WeatherEnv {
  VISUALCROSSING_BASE_URL: string;
  VISUALCROSSING_API_KEY?: string;
}

const n = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(x) ? x : 0;
};
const s = (v: unknown): string => (v == null ? "" : String(v));

export async function fetchWeather(
  env: WeatherEnv,
  lat: string,
  lng: string,
  acqDate: string,
): Promise<WeatherRow | null> {
  if (!env.VISUALCROSSING_API_KEY) return null;
  // Request the specific date as a single daily aggregate: 1 VisualCrossing
  // "record" per call, and correct for backfilled past dates (not just "current").
  const url =
    `${env.VISUALCROSSING_BASE_URL}/${lat},${lng}/${acqDate}` +
    `?key=${env.VISUALCROSSING_API_KEY}&include=days&unitGroup=metric&timezone=Z`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`VisualCrossing HTTP ${res.status}`);
  const j = (await res.json()) as { days?: Record<string, unknown>[] };
  const d = j.days?.[0];
  if (!d) return null;
  return {
    latitude: lat,
    longitude: lng,
    datetime: `${acqDate} 00:00:00.000`,
    temperature: Math.round(n(d.temp)),
    humidity: n(d.humidity),
    wind_speed: n(d.windspeed),
    wind_degree: n(d.winddir),
    visibility: Math.round(n(d.visibility)),
    cloud_coverage: Math.round(n(d.cloudcover)),
    pressure: Math.round(n(d.pressure)),
    uv_index: Math.round(n(d.uvindex)),
    precipitation: n(d.precip),
    solar_radiation: n(d.solarradiation),
    conditions: s(d.conditions),
    icon: s(d.icon),
  };
}

// Fetches weather for a list of unique coordinates sequentially (VC rate limits).
export async function fetchWeatherBulk(
  env: WeatherEnv,
  coords: { lat: string; lng: string; acqDate: string }[],
): Promise<WeatherRow[]> {
  if (!env.VISUALCROSSING_API_KEY) return [];
  const out: WeatherRow[] = [];
  for (const c of coords) {
    try {
      const row = await fetchWeather(env, c.lat, c.lng, c.acqDate);
      if (row) out.push(row);
    } catch (e) {
      log.warn("weather fetch failed", { lat: c.lat, lng: c.lng, error: String(e) });
    }
  }
  return out;
}
