// Staging rows -> star-schema dim/fact rows, ported from HotspotTransformer.
// Dimension ids are reused by natural key (loaded from D1); only unseen keys
// get a fresh ULID, matching the Python IDMappings behaviour.
import { ulid } from "./ulid";
import { derivePeriod } from "./period";
import type { HotspotRaw } from "./firms";
import type { WeatherRow } from "./weather";
import { coordKey } from "./geocode";

export function deriveProduct(version: string): string {
  return String(version).toUpperCase().includes("NRT") ? "NRT" : "SP";
}

export interface DimPeriod {
  id: string; date_value: string; year_value: number; semester_value: number;
  quarter_value: number; month_value: number; month_name: string; week_value: number;
}
export interface DimSatellite {
  id: string; satellite_name: string; instrument: string; product: string; version: string;
  spatial_resolution_m: number; temporal_resolution_hours: number; description: string;
}
export interface DimConfidence {
  id: string; confidence_raw: string; source_instrument: string; confidence_class: string;
  confidence_numeric: number; confidence_score: number; description: string;
}
export interface DimWeatherCondition { id: string; conditions: string; icon: string; }
export interface FactHotspot {
  id: string; satellite_id: string; confidence_id: string; period_id: string; location_id: string;
  acquired_at: string; frp: number; brightness: number; latitude: string; longitude: string;
  scan: number; track: number; bright_t31: number; bright_ti4: number; bright_ti5: number;
}
export interface FactWeather {
  id: string; period_id: string; location_id: string; weather_condition_id: string; acquired_at: string;
  temperature: number; humidity: number; wind_speed: number; wind_degree: number; visibility: number;
  cloud_coverage: number; latitude: string; longitude: string; pressure: number; uv_index: number;
  precipitation: number; solar_radiation: number;
}

export interface TransformResult {
  dimPeriod: DimPeriod[];
  dimSatellite: DimSatellite[];
  dimConfidence: DimConfidence[];
  dimWeatherCondition: DimWeatherCondition[];
  factHotspot: FactHotspot[];
  factWeather: FactWeather[];
}

function classifyConfidence(confidence: string, instrument: string) {
  if (instrument === "MODIS") {
    const n = parseInt(confidence, 10);
    const v = Number.isFinite(n) ? n : 0;
    const cls = v >= 80 ? "HIGH" : v >= 30 ? "MEDIUM" : "LOW";
    return {
      confidence_class: cls,
      confidence_numeric: v,
      confidence_score: v / 100,
      description: "MODIS confidence percentage (0-100), standarisasi Permen LHK No. 8/2018",
    };
  }
  if (instrument === "VIIRS") {
    const c = confidence;
    const high = c === "h" || c === "high";
    const nom = c === "n" || c === "nominal";
    const cls = high ? "HIGH" : nom ? "MEDIUM" : "LOW";
    return {
      confidence_class: cls,
      confidence_numeric: high ? 85 : nom ? 50 : 15,
      confidence_score: high ? 0.85 : nom ? 0.5 : 0.15,
      description:
        "VIIRS confidence category (low/nominal/high) mapped to LOW/MEDIUM/HIGH per Permen LHK No. 8/2018",
    };
  }
  return { confidence_class: "UNKNOWN", confidence_numeric: 0, confidence_score: 0, description: "Unknown confidence format" };
}

function satelliteMeta(instrument: string) {
  if (instrument === "MODIS")
    return { spatial_resolution_m: 1000, temporal_resolution_hours: 12, description: "Moderate Resolution Imaging Spectroradiometer" };
  if (instrument === "VIIRS")
    return { spatial_resolution_m: 375, temporal_resolution_hours: 6, description: "Visible Infrared Imaging Radiometer Suite" };
  return { spatial_resolution_m: 1000, temporal_resolution_hours: 12, description: "Unknown instrument" };
}

// Loads existing dim natural-key -> id maps so we reuse ids across runs.
export class IdMap {
  period = new Map<string, string>();
  satellite = new Map<string, string>();
  confidence = new Map<string, string>();
  weatherCondition = new Map<string, string>();
  newPeriod: DimPeriod[] = [];
  newSatellite: DimSatellite[] = [];
  newConfidence: DimConfidence[] = [];
  newWeatherCondition: DimWeatherCondition[] = [];

  constructor(private db: D1Database) {}

  async preload(): Promise<void> {
    const p = await this.db.prepare("SELECT date_value, id FROM dim_period").all<{ date_value: string; id: string }>();
    for (const r of p.results ?? []) this.period.set(r.date_value, r.id);
    const s = await this.db.prepare("SELECT satellite_name, instrument, product, id FROM dim_satellite").all<{ satellite_name: string; instrument: string; product: string; id: string }>();
    for (const r of s.results ?? []) this.satellite.set(`${r.satellite_name}_${r.instrument}_${r.product}`, r.id);
    const c = await this.db.prepare("SELECT confidence_raw, source_instrument, id FROM dim_confidence").all<{ confidence_raw: string; source_instrument: string; id: string }>();
    for (const r of c.results ?? []) this.confidence.set(`${r.confidence_raw}_${r.source_instrument}`, r.id);
    const w = await this.db.prepare("SELECT conditions, id FROM dim_weather_condition").all<{ conditions: string; id: string }>();
    for (const r of w.results ?? []) this.weatherCondition.set(r.conditions, r.id);
  }

  periodId(dateValue: string): string {
    let id = this.period.get(dateValue);
    if (!id) {
      id = ulid();
      this.period.set(dateValue, id);
      this.newPeriod.push({ id, ...derivePeriod(dateValue) });
    }
    return id;
  }
  satelliteId(name: string, instrument: string, product: string, version: string): string {
    const key = `${name}_${instrument}_${product}`;
    let id = this.satellite.get(key);
    if (!id) {
      id = ulid();
      this.satellite.set(key, id);
      this.newSatellite.push({ id, satellite_name: name, instrument, product, version, ...satelliteMeta(instrument) });
    }
    return id;
  }
  confidenceId(raw: string, instrument: string): string {
    const key = `${raw}_${instrument}`;
    let id = this.confidence.get(key);
    if (!id) {
      id = ulid();
      this.confidence.set(key, id);
      this.newConfidence.push({ id, confidence_raw: raw, source_instrument: instrument, ...classifyConfidence(raw, instrument) });
    }
    return id;
  }
  weatherConditionId(conditions: string, icon: string): string {
    let id = this.weatherCondition.get(conditions);
    if (!id) {
      id = ulid();
      this.weatherCondition.set(conditions, id);
      this.newWeatherCondition.push({ id, conditions, icon });
    }
    return id;
  }
}

function acquiredAt(acqDate: string, acqTime: string): string {
  const t = acqTime.padStart(4, "0");
  return `${acqDate} ${t.slice(0, 2)}:${t.slice(2, 4)}:00.000`;
}

export async function transform(
  db: D1Database,
  hotspots: HotspotRaw[],
  locationByCoord: Map<string, string>,
  weather: WeatherRow[],
): Promise<TransformResult> {
  const idmap = new IdMap(db);
  await idmap.preload();

  // Dedup hotspots by natural key, preferring SP over NRT (like the Python sort+unique).
  const chosen = new Map<string, HotspotRaw>();
  for (const h of hotspots) {
    const product = deriveProduct(h.version);
    const key = `${h.latitude}|${h.longitude}|${h.acq_date}|${h.acq_time}|${h.satellite}|${h.instrument}`;
    const prev = chosen.get(key);
    if (!prev) chosen.set(key, h);
    else if (deriveProduct(prev.version) === "NRT" && product === "SP") chosen.set(key, h);
  }

  const factHotspot: FactHotspot[] = [];
  for (const h of [...chosen.values()]) {
    const locationId = locationByCoord.get(coordKey(h.latitude, h.longitude));
    if (!locationId) continue; // drop rows with no resolved location (matches Python)
    const product = deriveProduct(h.version);
    factHotspot.push({
      id: `${h.latitude}:${h.longitude}:${h.acq_date}:${h.acq_time}:${h.satellite}:${h.instrument}:${h.version}`,
      satellite_id: idmap.satelliteId(h.satellite, h.instrument, product, h.version),
      confidence_id: idmap.confidenceId(h.confidence, h.instrument),
      period_id: idmap.periodId(h.acq_date),
      location_id: locationId,
      acquired_at: acquiredAt(h.acq_date, h.acq_time),
      frp: h.frp, brightness: h.brightness, latitude: h.latitude, longitude: h.longitude,
      scan: h.scan, track: h.track, bright_t31: h.bright_t31, bright_ti4: h.bright_ti4, bright_ti5: h.bright_ti5,
    });
  }

  const factWeather: FactWeather[] = [];
  for (const w of weather) {
    const locationId = locationByCoord.get(coordKey(w.latitude, w.longitude));
    if (!locationId) continue;
    const dateValue = w.datetime.slice(0, 10);
    factWeather.push({
      id: `${w.latitude}:${w.longitude}:${w.datetime}`,
      period_id: idmap.periodId(dateValue),
      location_id: locationId,
      weather_condition_id: idmap.weatherConditionId(w.conditions, w.icon),
      acquired_at: w.datetime,
      temperature: w.temperature, humidity: w.humidity, wind_speed: w.wind_speed, wind_degree: w.wind_degree,
      visibility: w.visibility, cloud_coverage: w.cloud_coverage, latitude: w.latitude, longitude: w.longitude,
      pressure: w.pressure, uv_index: w.uv_index, precipitation: w.precipitation, solar_radiation: w.solar_radiation,
    });
  }

  return {
    dimPeriod: idmap.newPeriod,
    dimSatellite: idmap.newSatellite,
    dimConfidence: idmap.newConfidence,
    dimWeatherCondition: idmap.newWeatherCondition,
    factHotspot,
    factWeather,
  };
}

// ---------- Weather backfill transform ----------
import type { WeatherJob } from "./load";

// Builds fact_weather rows from fetched VisualCrossing data. location_id and
// period_id come from the queued job (captured at ingest), so no re-geocoding.
// Reuses existing dim_weather_condition ids; only unseen conditions get a ULID.
export async function buildWeatherFacts(
  db: D1Database,
  weather: WeatherRow[],
  jobs: WeatherJob[],
): Promise<{ factWeather: FactWeather[]; newWeatherConditions: DimWeatherCondition[] }> {
  const idmap = new IdMap(db);
  await idmap.preload();

  const jobByKey = new Map<string, WeatherJob>();
  for (const j of jobs) jobByKey.set(`${j.latitude}|${j.longitude}|${j.date_value}`, j);

  const factWeather: FactWeather[] = [];
  for (const w of weather) {
    const dateValue = w.datetime.slice(0, 10);
    const job = jobByKey.get(`${w.latitude}|${w.longitude}|${dateValue}`);
    if (!job) continue;
    factWeather.push({
      id: `${w.latitude}:${w.longitude}:${w.datetime}`,
      period_id: job.period_id,
      location_id: job.location_id,
      weather_condition_id: idmap.weatherConditionId(w.conditions, w.icon),
      acquired_at: w.datetime,
      temperature: w.temperature, humidity: w.humidity, wind_speed: w.wind_speed, wind_degree: w.wind_degree,
      visibility: w.visibility, cloud_coverage: w.cloud_coverage, latitude: w.latitude, longitude: w.longitude,
      pressure: w.pressure, uv_index: w.uv_index, precipitation: w.precipitation, solar_radiation: w.solar_radiation,
    });
  }
  return { factWeather, newWeatherConditions: idmap.newWeatherCondition };
}
