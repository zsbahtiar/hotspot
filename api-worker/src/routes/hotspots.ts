import { Hono } from "hono";
import type { Bindings } from "../types";
import { envelope } from "../types";
import { Cache, TTL } from "../lib/cache";
import {
  parseRFC3339,
  rfc3339OffsetMinutes,
  boundedInt,
  intParam,
  strParam,
  sqlDate,
} from "../lib/params";
import { extractIslandFromProvinceCode, offsetToTimezone } from "../lib/geo";
import type {
  HotspotFilters,
  HotspotDetail,
  GeoJSON,
  GeoJSONFeature,
  SummaryResponse,
  IslandGroup,
} from "../domain";
import * as repo from "../repo/hotspot";

const app = new Hono<{ Bindings: Bindings }>({ strict: false });

function defaultStart(): Date {
  return new Date(Date.UTC(2000, 0, 1, 0, 0, 0, 0));
}
function defaultEnd(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 23, 59, 59, 999));
}

function emptyFilters(): HotspotFilters {
  return {
    startDate: null, endDate: null,
    year: 0, semester: 0, quarter: 0, month: 0, week: 0,
    provinceCode: "", cityCode: "", districtCode: "", subdistrictCode: "",
    satelliteId: "", productId: "", confidenceId: "",
    limit: 0, cursor: "",
  };
}

// cache key parts for list/geojson, mirroring Go's buildHotspotCacheKey.
function hotspotCacheKey(prefix: string, f: HotspotFilters): string {
  const s = f.startDate ? sqlDate(f.startDate) : "";
  const e = f.endDate ? sqlDate(f.endDate) : "";
  return [
    prefix, s, e, f.year, f.semester, f.quarter, f.month, f.week,
    f.provinceCode, f.cityCode, f.districtCode, f.subdistrictCode,
    f.satelliteId, f.productId, f.confidenceId, f.limit, f.cursor,
  ].join(":");
}

// True when no filters/date-range narrowing is applied, i.e. the total equals
// the whole fact_hotspot table. The plain list endpoint is always this case.
function isAllView(f: HotspotFilters): boolean {
  if (f.provinceCode || f.cityCode || f.districtCode || f.subdistrictCode) return false;
  if (f.satelliteId || f.productId || f.confidenceId) return false;
  if (f.year || f.semester || f.quarter || f.month || f.week) return false;
  if (!f.startDate || !f.endDate) return false;
  const ds = defaultStart();
  return f.startDate.getTime() === ds.getTime() && sqlDate(f.endDate) === sqlDate(defaultEnd());
}

// Cached whole-table count (6h TTL, and auto-invalidated on ingest via the KV
// version prefix), so the default view skips the ~750ms count(*) scan.
async function getAllTotal(cache: Cache, db: D1Database): Promise<number> {
  const cached = await cache.get<number>("count:fh:all");
  if (typeof cached === "number") return cached;
  const row = await db.prepare("SELECT count(*) AS c FROM fact_hotspot").first<{ c: number }>();
  const total = row?.c ?? 0;
  await cache.set("count:fh:all", total, 6 * 60 * 60);
  return total;
}

// lite=true drops the heavy per-point fields (frp, brightness, weather) so tens
// of thousands of markers fit in the Worker's memory. Those fields are fetched
// per point via /detail when a marker is clicked.
function transformToGeoJSON(hotspots: HotspotDetail[], lite = false): GeoJSON {
  const features: GeoJSONFeature[] = [];
  for (const h of hotspots) {
    const lat = parseFloat(h.latitude);
    const lon = parseFloat(h.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;
    const ts = h.acquired_at;
    // Minimal fields the cluster map actually reads (marker colour, client-side
    // filter by confidence/satellite/product/time, location grouping).
    const properties: Record<string, unknown> = {
      id: h.id,
      time: ts,
      hotspot_count: 1,
      confidence: h.confidence_class,
      satellite: h.satellite_name,
      product: h.product,
      location: {
        province_name: h.province_name,
        city_name: h.city_name,
        district_name: h.district_name,
        subdistrict_name: h.subdistrict_name,
        provinsi: h.province_name,
        kab_kota: h.city_name,
        kecamatan: h.district_name,
        desa: h.subdistrict_name,
        pulau: extractIslandFromProvinceCode(h.province_code),
      },
    };
    if (!lite) {
      Object.assign(properties, {
        acquired_at: ts,
        hotspot_time: ts,
        confidence_class: h.confidence_class,
        satellite_name: h.satellite_name,
        instrument: "",
        frp: h.frp,
        brightness: h.brightness,
        bright_t31: h.bright_t31,
        bright_ti4: h.bright_ti4,
        bright_ti5: h.bright_ti5,
        temperature: h.temperature,
        humidity: h.humidity,
        wind_speed: h.wind_speed,
        wind_degree: h.wind_degree,
        visibility: h.visibility,
        cloud_coverage: h.cloud_coverage,
        pressure: h.pressure,
        uv_index: h.uv_index,
        precipitation: h.precipitation,
        solar_radiation: h.solar_radiation,
        weather_conditions: h.weather_conditions,
        weather_icon: h.weather_icon,
      });
    }
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties,
    });
  }
  return { type: "FeatureCollection", features };
}

// GET /hotspots  (list)
app.get("/", async (c) => {
  const cache = new Cache(c.env.CACHE);
  const f = emptyFilters();
  f.limit = boundedInt(c, "limit", 0, 1, 100);
  f.startDate = defaultStart();
  f.endDate = defaultEnd();

  const key = hotspotCacheKey("hotspots", f);
  const cached = await cache.get<unknown>(key);
  if (cached) return c.json(envelope("Hotspots retrieved successfully", cached));

  // The plain list is always the unfiltered full-range view -> use the cached total.
  const total = await getAllTotal(cache, c.env.DB);
  const result = await repo.getHotspots(c.env.DB, f, total);
  c.executionCtx.waitUntil(cache.set(key, result, TTL.hotspots));
  return c.json(envelope("Hotspots retrieved successfully", result));
});

// GET /hotspots/geojson
app.get("/geojson", async (c) => {
  const cache = new Cache(c.env.CACHE);
  const f = emptyFilters();
  f.cursor = strParam(c, "cursor");
  f.satelliteId = strParam(c, "satellite");
  f.productId = strParam(c, "product");
  f.confidenceId = strParam(c, "confidence");
  f.provinceCode = strParam(c, "province_code");
  f.cityCode = strParam(c, "city_code");
  f.districtCode = strParam(c, "district_code");
  f.subdistrictCode = strParam(c, "subdistrict_code");
  f.startDate = parseRFC3339(c.req.query("start_date"));
  f.endDate = parseRFC3339(c.req.query("end_date"));
  f.year = intParam(c, "year");
  f.semester = intParam(c, "semester");
  f.quarter = intParam(c, "quarter");
  f.month = intParam(c, "month");
  f.week = intParam(c, "week");

  if (f.year > 0 && !f.startDate && !f.endDate) {
    f.startDate = new Date(Date.UTC(f.year, 0, 1, 0, 0, 0, 0));
    f.endDate = new Date(Date.UTC(f.year, 11, 31, 23, 59, 59, 999));
  }
  // Cap features per request: building tens of thousands of GeoJSON features in
  // memory exceeds the Worker's 128MB limit. Maps should cluster / paginate via
  // the cursor for larger sets.
  f.limit = boundedInt(c, "limit", 500, 1, 10000);

  // service defaults for missing dates
  if (!f.startDate) f.startDate = defaultStart();
  if (!f.endDate) f.endDate = defaultEnd();

  const key = hotspotCacheKey("geojson", f);
  const cached = await cache.get<GeoJSON>(key);
  if (cached) {
    c.header("Cache-Control", "public, s-maxage=4800, max-age=2400");
    return c.json(envelope("Hotspots GeoJSON retrieved successfully", cached));
  }

  const total = isAllView(f) ? await getAllTotal(cache, c.env.DB) : undefined;
  const result = await repo.getHotspots(c.env.DB, f, total);
  const geo = transformToGeoJSON(result.hotspots);
  geo.pagination = result.pagination;
  c.executionCtx.waitUntil(cache.set(key, geo, TTL.geojson));
  c.header("Cache-Control", "public, s-maxage=4800, max-age=2400");
  return c.json(envelope("Hotspots GeoJSON retrieved successfully", geo));
});

// GET /hotspots/markers  (lean GeoJSON for the cluster map: no weather/frp/brightness,
// so tens of thousands of points fit. Fetch heavy fields per point via /detail.)
app.get("/markers", async (c) => {
  const cache = new Cache(c.env.CACHE);
  const f = emptyFilters();
  f.cursor = strParam(c, "cursor");
  f.satelliteId = strParam(c, "satellite");
  f.productId = strParam(c, "product");
  f.confidenceId = strParam(c, "confidence");
  f.provinceCode = strParam(c, "province_code");
  f.cityCode = strParam(c, "city_code");
  f.districtCode = strParam(c, "district_code");
  f.subdistrictCode = strParam(c, "subdistrict_code");
  f.startDate = parseRFC3339(c.req.query("start_date"));
  f.endDate = parseRFC3339(c.req.query("end_date"));
  f.year = intParam(c, "year");
  f.semester = intParam(c, "semester");
  f.quarter = intParam(c, "quarter");
  f.month = intParam(c, "month");
  f.week = intParam(c, "week");
  if (f.year > 0 && !f.startDate && !f.endDate) {
    f.startDate = new Date(Date.UTC(f.year, 0, 1, 0, 0, 0, 0));
    f.endDate = new Date(Date.UTC(f.year, 11, 31, 23, 59, 59, 999));
  }
  f.limit = boundedInt(c, "limit", 10000, 1, 30000); // lean features -> higher cap
  if (!f.startDate) f.startDate = defaultStart();
  if (!f.endDate) f.endDate = defaultEnd();

  const key = hotspotCacheKey("markers", f);
  const cached = await cache.get<GeoJSON>(key);
  if (cached) {
    c.header("Cache-Control", "public, s-maxage=4800, max-age=2400");
    return c.json(envelope("Markers retrieved successfully", cached));
  }

  const total = isAllView(f) ? await getAllTotal(cache, c.env.DB) : undefined;
  const result = await repo.getHotspots(c.env.DB, f, total, true); // lean query (no weather join)
  const geo = transformToGeoJSON(result.hotspots, true); // lite properties
  geo.pagination = result.pagination;
  c.executionCtx.waitUntil(cache.set(key, geo, TTL.geojson));
  c.header("Cache-Control", "public, s-maxage=4800, max-age=2400");
  return c.json(envelope("Markers retrieved successfully", geo));
});

// GET /hotspots/detail?id=<opaque id>  (full fields for one point, for the popup)
app.get("/detail", async (c) => {
  const idParam = strParam(c, "id");
  if (!idParam) return c.json({ message: "id is required", success: false }, 400);
  let rawId = idParam;
  try {
    rawId = atob(idParam);
  } catch {
    rawId = idParam; // accept a raw id too
  }
  const detail = await repo.getById(c.env.DB, rawId);
  if (!detail) return c.json({ message: "resource not found", success: false }, 404);
  return c.json(envelope("Hotspot detail retrieved successfully", detail));
});

// GET /hotspots/summary
app.get("/summary", async (c) => {
  const cache = new Cache(c.env.CACHE);
  const provinceLimit = boundedInt(c, "province_limit", 10, 1, 100);
  const cityLimit = boundedInt(c, "city_limit", 10, 1, 100);

  let startDate = parseRFC3339(c.req.query("start_date"));
  let endDate = parseRFC3339(c.req.query("end_date"));
  let timezone = "UTC";
  if (c.req.query("start_date") && startDate) {
    timezone = offsetToTimezone(rfc3339OffsetMinutes(c.req.query("start_date")));
  }
  if (!startDate) startDate = defaultStart();
  if (!endDate) endDate = defaultEnd();

  const key = `summary:province_limit:${provinceLimit}:city_limit:${cityLimit}:start:${sqlDate(startDate)}:end:${sqlDate(endDate)}:tz:${timezone}`;
  const cached = await cache.get<SummaryResponse>(key);
  if (cached) {
    c.header("Cache-Control", "public, s-maxage=4800, max-age=2400");
    return c.json(envelope("Summary retrieved successfully", cached));
  }

  const [
    topProvinces, topCities, satelliteDistribution, stats,
    monthlyStats, todayStats, confidenceDistribution,
  ] = await Promise.all([
    repo.getTopProvinces(c.env.DB, startDate, endDate, provinceLimit),
    repo.getTopCities(c.env.DB, startDate, endDate, cityLimit),
    repo.getSatelliteDistribution(c.env.DB, startDate, endDate),
    repo.getStats(c.env.DB, startDate, endDate),
    repo.getMonthlyStats(c.env.DB, startDate, endDate, timezone),
    repo.getTodayStats(c.env.DB, timezone),
    repo.getConfidenceDistribution(c.env.DB, startDate, endDate),
  ]);

  const result: SummaryResponse = {
    top_provinces: topProvinces,
    top_cities: topCities,
    satellite_distribution: satelliteDistribution,
    stats,
    monthly_stats: monthlyStats,
    today_stats: todayStats,
    confidence_distribution: confidenceDistribution,
  };
  c.executionCtx.waitUntil(cache.set(key, result, TTL.summary));
  c.header("Cache-Control", "public, s-maxage=4800, max-age=2400");
  return c.json(envelope("Summary retrieved successfully", result));
});

// GET /hotspots/filter-options
app.get("/filter-options", async (c) => {
  const cache = new Cache(c.env.CACHE);
  const key = "filter_options";
  const cached = await cache.get<unknown>(key);
  if (cached) return c.json(envelope("Filter options retrieved successfully", cached));

  const [confidence, satellites, products] = await Promise.all([
    repo.getConfidenceList(c.env.DB),
    repo.getSatelliteList(c.env.DB),
    repo.getProductList(c.env.DB),
  ]);
  const result = { confidence, satellites, products };
  c.executionCtx.waitUntil(cache.set(key, result, TTL.filterOptions));
  return c.json(envelope("Filter options retrieved successfully", result));
});

// GET /hotspots/periods
app.get("/periods", async (c) => {
  const cache = new Cache(c.env.CACHE);
  const req = {
    year: intParam(c, "year"),
    semester: intParam(c, "semester"),
    quarter: intParam(c, "quarter"),
    month: intParam(c, "month"),
  };
  const key = `periods:${req.year}:${req.semester}:${req.quarter}:${req.month}`;
  const cached = await cache.get<unknown>(key);
  if (cached) return c.json(envelope("Periods retrieved successfully", cached));

  const result = await repo.getPeriods(c.env.DB, req);
  c.executionCtx.waitUntil(cache.set(key, result, TTL.periods));
  return c.json(envelope("Periods retrieved successfully", result));
});

// GET /hotspots/locations
app.get("/locations", async (c) => {
  const cache = new Cache(c.env.CACHE);
  const f = emptyFilters();
  f.provinceCode = strParam(c, "province_code");
  f.cityCode = strParam(c, "city_code");
  f.districtCode = strParam(c, "district_code");
  f.satelliteId = strParam(c, "satellite");
  f.productId = strParam(c, "product");
  f.confidenceId = strParam(c, "confidence");
  f.startDate = parseRFC3339(c.req.query("start_date"));
  f.endDate = parseRFC3339(c.req.query("end_date"));
  f.year = intParam(c, "year");
  f.semester = intParam(c, "semester");
  f.quarter = intParam(c, "quarter");
  f.month = intParam(c, "month");
  f.week = intParam(c, "week");
  if (f.year > 0 && !f.startDate && !f.endDate) {
    f.startDate = new Date(Date.UTC(f.year, 0, 1, 0, 0, 0, 0));
    f.endDate = new Date(Date.UTC(f.year, 11, 31, 23, 59, 59, 999));
  }

  const key = `locations:v4:${f.provinceCode}:${f.cityCode}:${f.districtCode}:${f.year}:${f.semester}:${f.quarter}:${f.month}:${f.week}:${f.satelliteId}:${f.productId}:${f.confidenceId}:${f.startDate ? sqlDate(f.startDate) : ""}:${f.endDate ? sqlDate(f.endDate) : ""}`;
  const cached = await cache.get<unknown>(key);
  if (cached) {
    c.header("Cache-Control", "public, s-maxage=4800, max-age=2400");
    return c.json(envelope("Locations retrieved successfully", cached));
  }

  const result = await repo.getLocations(c.env.DB, f);

  // Group provinces into islands at the top level (mirrors the Go service).
  if (!f.provinceCode && !f.cityCode && !f.districtCode && result.provinces && result.provinces.length > 0) {
    const islandMap = new Map<string, IslandGroup>();
    const order: string[] = [];
    for (const p of result.provinces) {
      const pulau = extractIslandFromProvinceCode(p.code);
      p.pulau = pulau;
      if (!islandMap.has(pulau)) {
        islandMap.set(pulau, { name: pulau, count: 0, lat: 0, lng: 0, provinces: [] });
        order.push(pulau);
      }
      const g = islandMap.get(pulau)!;
      g.provinces.push(p);
      g.count += p.count;
    }
    const islands: IslandGroup[] = [];
    for (const pulau of order) {
      const g = islandMap.get(pulau)!;
      if (g.provinces.length > 0) {
        let totalLat = 0, totalLng = 0;
        for (const prov of g.provinces) { totalLat += prov.lat; totalLng += prov.lng; }
        g.lat = totalLat / g.provinces.length;
        g.lng = totalLng / g.provinces.length;
      }
      islands.push(g);
    }
    islands.sort((a, b) => b.count - a.count);
    result.islands = islands;
    delete result.provinces;
  }

  c.executionCtx.waitUntil(cache.set(key, result, TTL.locations));
  c.header("Cache-Control", "public, s-maxage=4800, max-age=2400");
  return c.json(envelope("Locations retrieved successfully", result));
});

export default app;
