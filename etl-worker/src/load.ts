// Batched idempotent writes into the shared D1 database, plus cache invalidation.
import type { LocationRow } from "./geocode";
import type { TransformResult, DimWeatherCondition, FactWeather } from "./transform";

const CHUNK = 40; // keep well under D1's per-batch statement/bound-var limits

async function insertMany(
  db: D1Database,
  table: string,
  columns: string[],
  rows: Record<string, unknown>[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const placeholders = `(${columns.map(() => "?").join(",")})`;
  const sql = `INSERT OR IGNORE INTO ${table} (${columns.join(",")}) VALUES ${placeholders}`;
  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const stmts = chunk.map((r) => db.prepare(sql).bind(...columns.map((c) => r[c] ?? null)));
    await db.batch(stmts);
    written += chunk.length;
  }
  return written;
}

const VERSION_KEY = "__cache_version__";

// Bumps the KV cache version so api-worker's cached responses are invalidated.
async function bumpCacheVersion(kv: KVNamespace): Promise<string> {
  const current = (await kv.get(VERSION_KEY)) ?? "v1";
  const n = parseInt(current.replace(/^v/, ""), 10) || 1;
  const next = `v${n + 1}`;
  await kv.put(VERSION_KEY, next);
  return next;
}

export interface LoadCounts {
  dim_location: number;
  dim_period: number;
  dim_satellite: number;
  dim_confidence: number;
  dim_weather_condition: number;
  fact_hotspot: number;
  fact_weather: number;
  cache_version: string;
}

// Loads the ingest output: dims + fact_hotspot (no weather). Bumps cache.
export async function load(
  db: D1Database,
  kv: KVNamespace,
  newLocations: LocationRow[],
  t: TransformResult,
): Promise<LoadCounts> {
  const dim_location = await insertMany(db, "dim_location",
    ["id", "province_code", "province_name", "city_code", "city_name", "district_code", "district_name", "subdistrict_code", "subdistrict_name"],
    newLocations as unknown as Record<string, unknown>[]);
  const dim_period = await insertMany(db, "dim_period",
    ["id", "date_value", "year_value", "semester_value", "quarter_value", "month_value", "month_name", "week_value"],
    t.dimPeriod as unknown as Record<string, unknown>[]);
  const dim_satellite = await insertMany(db, "dim_satellite",
    ["id", "satellite_name", "instrument", "product", "version", "spatial_resolution_m", "temporal_resolution_hours", "description"],
    t.dimSatellite as unknown as Record<string, unknown>[]);
  const dim_confidence = await insertMany(db, "dim_confidence",
    ["id", "confidence_raw", "source_instrument", "confidence_class", "confidence_numeric", "confidence_score", "description"],
    t.dimConfidence as unknown as Record<string, unknown>[]);
  const dim_weather_condition = await insertMany(db, "dim_weather_condition",
    ["id", "conditions", "icon"], t.dimWeatherCondition as unknown as Record<string, unknown>[]);
  const fact_hotspot = await insertMany(db, "fact_hotspot",
    ["id", "satellite_id", "confidence_id", "period_id", "location_id", "acquired_at", "frp", "brightness", "latitude", "longitude", "scan", "track", "bright_t31", "bright_ti4", "bright_ti5"],
    t.factHotspot as unknown as Record<string, unknown>[]);
  const fact_weather = await insertMany(db, "fact_weather",
    ["id", "period_id", "location_id", "weather_condition_id", "acquired_at", "temperature", "humidity", "wind_speed", "wind_degree", "visibility", "cloud_coverage", "latitude", "longitude", "pressure", "uv_index", "precipitation", "solar_radiation"],
    t.factWeather as unknown as Record<string, unknown>[]);

  const cache_version = await bumpCacheVersion(kv);
  return { dim_location, dim_period, dim_satellite, dim_confidence, dim_weather_condition, fact_hotspot, fact_weather, cache_version };
}

// ---------- Async weather backfill (no queue table) ----------
//
// The set of "pending" weather work is derived directly from the data: any
// (location_id, period_id) that has hotspots but no fact_weather row. We bound
// the scan to a recent window so the anti-join stays cheap.

export interface WeatherJob {
  latitude: string;
  longitude: string;
  date_value: string; // YYYY-MM-DD
  location_id: string;
  period_id: string;
}

// Recent hotspots (most-recent first) whose (location, period) has no weather.
// We deliberately avoid GROUP BY: grouping by (location_id, period_id) makes
// SQLite pick idx_fh_loc_period and full-scan the table, whereas ORDER BY
// acquired_at uses idx_fh_acq_id and only scans the recent window. Dedup by
// (location, period) happens in code. `sinceIso` bounds the scan window.
export async function fetchMissingWeather(
  db: D1Database,
  sinceIso: string,
  limit: number,
): Promise<WeatherJob[]> {
  const scanLimit = Math.max(limit * 10, 500);
  const sql = `
    SELECT location_id, period_id, latitude, longitude,
           substr(acquired_at, 1, 10) AS date_value
    FROM fact_hotspot
    WHERE acquired_at >= ?
      AND NOT EXISTS (
        SELECT 1 FROM fact_weather fw
        WHERE fw.location_id = fact_hotspot.location_id
          AND fw.period_id = fact_hotspot.period_id
      )
    ORDER BY acquired_at DESC
    LIMIT ?`;
  const res = await db.prepare(sql).bind(sinceIso, scanLimit).all<WeatherJob>();
  const seen = new Set<string>();
  const jobs: WeatherJob[] = [];
  for (const r of res.results ?? []) {
    const key = `${r.location_id}|${r.period_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    jobs.push(r);
    if (jobs.length >= limit) break;
  }
  return jobs;
}

// KV-backed per-UTC-day counter that caps VisualCrossing usage at the free budget.
export async function budgetUsed(kv: KVNamespace, dateKey: string): Promise<number> {
  const v = await kv.get(`wbudget:${dateKey}`);
  return v ? parseInt(v, 10) || 0 : 0;
}

export async function addBudget(kv: KVNamespace, dateKey: string, n: number): Promise<void> {
  const cur = await budgetUsed(kv, dateKey);
  await kv.put(`wbudget:${dateKey}`, String(cur + n), { expirationTtl: 172800 });
}

// Writes backfilled weather (new dim_weather_condition + fact_weather) and bumps
// the API cache. A written fact_weather row is what removes an item from the
// derived "pending" set, so no queue bookkeeping is needed.
export async function loadWeatherFacts(
  db: D1Database,
  kv: KVNamespace,
  newWeatherConditions: DimWeatherCondition[],
  factWeather: FactWeather[],
): Promise<{ dim_weather_condition: number; fact_weather: number }> {
  const dim_weather_condition = await insertMany(
    db,
    "dim_weather_condition",
    ["id", "conditions", "icon"],
    newWeatherConditions as unknown as Record<string, unknown>[],
  );
  const fact_weather = await insertMany(
    db,
    "fact_weather",
    ["id", "period_id", "location_id", "weather_condition_id", "acquired_at", "temperature", "humidity", "wind_speed", "wind_degree", "visibility", "cloud_coverage", "latitude", "longitude", "pressure", "uv_index", "precipitation", "solar_radiation"],
    factWeather as unknown as Record<string, unknown>[],
  );
  if (fact_weather > 0) await bumpCacheVersion(kv);
  return { dim_weather_condition, fact_weather };
}

// ---------- Rollup maintenance ----------
// After ingesting hotspots, recompute the daily rollups for the affected dates
// so the (rollup-backed) summary stays correct. Recomputing a single day scans
// only that day's fact rows via idx_fh_acq_id, so it is cheap.
export async function refreshRollups(db: D1Database, dates: string[]): Promise<number> {
  for (const d of dates) {
    const lo = `${d} 00:00:00.000`;
    const hi = `${d} 23:59:59.999`;
    const stmts = [
      db.prepare("DELETE FROM agg_daily_province WHERE date_value = ?").bind(d),
      db.prepare(
        // GROUP BY matches the PK (province_code, confidence_class); province_name
        // is just a display attribute (a code may have naming variants across
        // sources), so take a representative one with MAX.
        `INSERT INTO agg_daily_province (date_value, province_code, province_name, confidence_class, cnt, sum_lat, sum_lng)
         SELECT ?, dl.province_code, MAX(dl.province_name), dc.confidence_class, count(*),
           SUM(CAST(fh.latitude AS REAL)), SUM(CAST(fh.longitude AS REAL))
         FROM fact_hotspot fh
         JOIN dim_location dl ON fh.location_id=dl.id
         JOIN dim_confidence dc ON fh.confidence_id=dc.id
         WHERE fh.acquired_at >= ? AND fh.acquired_at <= ?
         GROUP BY dl.province_code, dc.confidence_class`,
      ).bind(d, lo, hi),
      db.prepare("DELETE FROM agg_daily_city WHERE date_value = ?").bind(d),
      db.prepare(
        `INSERT INTO agg_daily_city (date_value, province_code, city_code, city_name, cnt, sum_lat, sum_lng)
         SELECT ?, MAX(dl.province_code), dl.city_code, MAX(dl.city_name), count(*),
           SUM(CAST(fh.latitude AS REAL)), SUM(CAST(fh.longitude AS REAL))
         FROM fact_hotspot fh JOIN dim_location dl ON fh.location_id=dl.id
         WHERE fh.acquired_at >= ? AND fh.acquired_at <= ?
         GROUP BY dl.city_code`,
      ).bind(d, lo, hi),
      db.prepare("DELETE FROM agg_daily_satellite WHERE date_value = ?").bind(d),
      db.prepare(
        `INSERT INTO agg_daily_satellite (date_value, satellite_name, cnt)
         SELECT ?, ds.satellite_name, count(*)
         FROM fact_hotspot fh JOIN dim_satellite ds ON fh.satellite_id=ds.id
         WHERE fh.acquired_at >= ? AND fh.acquired_at <= ?
         GROUP BY ds.satellite_name`,
      ).bind(d, lo, hi),
      db.prepare("DELETE FROM agg_daily_confidence WHERE date_value = ?").bind(d),
      db.prepare(
        `INSERT INTO agg_daily_confidence (date_value, confidence_class, cnt)
         SELECT ?, dc.confidence_class, count(*)
         FROM fact_hotspot fh JOIN dim_confidence dc ON fh.confidence_id=dc.id
         WHERE fh.acquired_at >= ? AND fh.acquired_at <= ?
         GROUP BY dc.confidence_class`,
      ).bind(d, lo, hi),
    ];
    await db.batch(stmts);
  }
  return dates.length;
}
