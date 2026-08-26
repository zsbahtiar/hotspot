import type {
  HotspotFilters,
  HotspotDetail,
  GetHotspotsResponse,
  LocationCount,
  DistributionCount,
  MonthlyStats,
  StatsResponse,
  TodayStatsResponse,
  FilterOption,
  PeriodsResponse,
  LocationsResponse,
  LocationHierarchyItem,
} from "../domain";
import { toSqlTs, sqlDate, toRFC3339, encodeCursor, decodeCursor } from "../lib/params";
import { tzOffsetHours } from "../lib/geo";

// Summary aggregates read the daily rollup tables (agg_daily_*) instead of
// scanning millions of fact rows. Date bounds are the UTC date of the range.
function dateBound(d: Date | null, fallback: string): string {
  return d ? sqlDate(d) : fallback;
}

// Builds the shared " AND ..." predicate list used by list/geojson (bare column names).
function buildFactFilters(f: HotspotFilters): { sql: string; args: unknown[] } {
  let sql = "";
  const args: unknown[] = [];
  if (f.provinceCode) {
    sql += " AND location_id IN (SELECT id FROM dim_location WHERE province_code = ?)";
    args.push(f.provinceCode);
  }
  if (f.cityCode) {
    sql += " AND location_id IN (SELECT id FROM dim_location WHERE city_code = ?)";
    args.push(f.cityCode);
  }
  if (f.districtCode) {
    sql += " AND location_id IN (SELECT id FROM dim_location WHERE district_code = ?)";
    args.push(f.districtCode);
  }
  if (f.subdistrictCode) {
    sql += " AND location_id IN (SELECT id FROM dim_location WHERE subdistrict_code = ?)";
    args.push(f.subdistrictCode);
  }
  if (f.satelliteId) {
    sql += " AND satellite_id IN (SELECT id FROM dim_satellite WHERE satellite_name = ?)";
    args.push(f.satelliteId);
  }
  if (f.productId) {
    sql += " AND satellite_id IN (SELECT id FROM dim_satellite WHERE product = ?)";
    args.push(f.productId);
  }
  if (f.confidenceId) {
    sql += " AND confidence_id IN (SELECT id FROM dim_confidence WHERE confidence_class = ?)";
    args.push(f.confidenceId);
  }
  if (f.year > 0) {
    sql += " AND period_id IN (SELECT id FROM dim_period WHERE year_value = ?)";
    args.push(f.year);
  }
  if (f.semester > 0) {
    sql += " AND period_id IN (SELECT id FROM dim_period WHERE semester_value = ?)";
    args.push(f.semester);
  }
  if (f.quarter > 0) {
    sql += " AND period_id IN (SELECT id FROM dim_period WHERE quarter_value = ?)";
    args.push(f.quarter);
  }
  if (f.month > 0) {
    sql += " AND period_id IN (SELECT id FROM dim_period WHERE month_value = ?)";
    args.push(f.month);
  }
  if (f.week > 0) {
    sql += " AND period_id IN (SELECT id FROM dim_period WHERE week_value = ?)";
    args.push(f.week);
  }
  return { sql, args };
}

export async function getHotspots(
  db: D1Database,
  f: HotspotFilters,
  precomputedTotal?: number,
  lean = false,
): Promise<GetHotspotsResponse> {
  const start = toSqlTs(f.startDate!);
  const end = toSqlTs(f.endDate!);
  const cursor = decodeCursor(f.cursor);
  const filters = buildFactFilters(f);

  // Total count only on the first page (cursor empty), matching the Go repo.
  // An exact count(*) scans the whole date range (~4.8M rows, ~750ms), so callers
  // can pass a precomputed total (e.g. the KV-cached unfiltered table count) to
  // skip it entirely for the common default view.
  let totalCount = 0;
  if (!f.cursor) {
    if (precomputedTotal !== undefined) {
      totalCount = precomputedTotal;
    } else {
      // Cap the count: an exact count over a non-selective filter (e.g. product=SP
      // is ~82% of rows) would scan the whole table (~14s). The LIMIT lets SQLite
      // stop early; a capped total ("100000+") is fine for pagination display.
      const COUNT_CAP = 100000;
      const countSql =
        `SELECT count(*) AS c FROM (SELECT 1 FROM fact_hotspot WHERE acquired_at >= ? AND acquired_at <= ?` +
        filters.sql +
        ` LIMIT ${COUNT_CAP + 1})`;
      const row = await db
        .prepare(countSql)
        .bind(start, end, ...filters.args)
        .first<{ c: number }>();
      totalCount = Math.min(row?.c ?? 0, COUNT_CAP); // COUNT_CAP means "at least this many"
    }
  }

  let limit = f.limit;
  if (limit <= 0) limit = 100;

  const innerArgs: unknown[] = [start, end, ...filters.args];
  let cursorClause = "";
  if (cursor) {
    cursorClause = " AND (acquired_at, id) < (?, ?)";
    innerArgs.push(cursor.acquiredAt, cursor.id);
  }
  innerArgs.push(limit + 1);

  // lean skips the fact_weather join entirely (markers do not use weather), so the
  // query never touches the 4.9M-row weather table and returns smaller rows.
  const weatherSelect = lean
    ? `0 AS temperature, 0 AS humidity, 0 AS wind_speed, 0 AS wind_degree,
      0 AS visibility, 0 AS cloud_coverage, 0 AS pressure, 0 AS uv_index,
      0 AS precipitation, 0 AS solar_radiation, '' AS weather_conditions, '' AS weather_icon`
    : `COALESCE(fw.temperature, 0) AS temperature, COALESCE(fw.humidity, 0) AS humidity,
      COALESCE(fw.wind_speed, 0) AS wind_speed, COALESCE(fw.wind_degree, 0) AS wind_degree,
      COALESCE(fw.visibility, 0) AS visibility, COALESCE(fw.cloud_coverage, 0) AS cloud_coverage,
      COALESCE(fw.pressure, 0) AS pressure, COALESCE(fw.uv_index, 0) AS uv_index,
      COALESCE(fw.precipitation, 0) AS precipitation, COALESCE(fw.solar_radiation, 0) AS solar_radiation,
      COALESCE(dwc.conditions, '') AS weather_conditions, COALESCE(dwc.icon, '') AS weather_icon`;
  const weatherJoin = lean
    ? ""
    : `LEFT JOIN (
      SELECT * FROM fact_weather WHERE acquired_at >= ? AND acquired_at <= ?
    ) fw ON fh.location_id = fw.location_id AND fh.period_id = fw.period_id
    LEFT JOIN dim_weather_condition dwc ON fw.weather_condition_id = dwc.id`;

  const sql = `
    SELECT
      fh.id AS id, fh.acquired_at AS acquired_at, fh.latitude AS latitude, fh.longitude AS longitude,
      fh.frp AS frp, fh.brightness AS brightness, fh.bright_t31 AS bright_t31,
      fh.bright_ti4 AS bright_ti4, fh.bright_ti5 AS bright_ti5,
      dc.confidence_class AS confidence_class,
      ds.satellite_name AS satellite_name, ds.product AS product,
      dl.province_code AS province_code, dl.province_name AS province_name,
      dl.city_code AS city_code, dl.city_name AS city_name,
      dl.district_code AS district_code, dl.district_name AS district_name,
      dl.subdistrict_code AS subdistrict_code, dl.subdistrict_name AS subdistrict_name,
      ${weatherSelect}
    FROM (
      SELECT * FROM fact_hotspot
      WHERE acquired_at >= ? AND acquired_at <= ?${filters.sql}${cursorClause}
      ORDER BY acquired_at DESC, id DESC
      LIMIT ?
    ) fh
    INNER JOIN dim_confidence dc ON fh.confidence_id = dc.id
    INNER JOIN dim_satellite ds ON fh.satellite_id = ds.id
    INNER JOIN dim_location dl ON fh.location_id = dl.id
    ${weatherJoin}
    ORDER BY fh.acquired_at DESC, fh.id DESC`;

  // The weather subquery adds the trailing start/end binds; lean has no such join.
  const res = await db
    .prepare(sql)
    .bind(...(lean ? innerArgs : [...innerArgs, start, end]))
    .all<HotspotDetail>();
  let rows = res.results ?? [];

  const hasNext = rows.length > limit;
  if (hasNext) rows = rows.slice(0, limit);

  let nextCursor: string | undefined;
  if (hasNext && rows.length > 0) {
    const last = rows[rows.length - 1];
    nextCursor = encodeCursor(last.acquired_at, last.id); // cursor uses the raw stored value
  }

  // Present timestamps as RFC3339 UTC, and the (natural-key) id as an opaque
  // base64 token. Both happen after the cursor is built from the raw values.
  for (const r of rows) {
    r.acquired_at = toRFC3339(r.acquired_at);
    r.id = btoa(r.id);
  }

  return {
    hotspots: rows,
    pagination: {
      total_count: totalCount,
      has_next: hasNext,
      next_cursor: nextCursor,
      limit,
    },
  };
}

// Full detail for a single hotspot by its (raw) id, used by the /detail popup.
export async function getById(db: D1Database, id: string): Promise<HotspotDetail | null> {
  const sql = `
    SELECT
      fh.id AS id, fh.acquired_at AS acquired_at, fh.latitude AS latitude, fh.longitude AS longitude,
      fh.frp AS frp, fh.brightness AS brightness, fh.bright_t31 AS bright_t31,
      fh.bright_ti4 AS bright_ti4, fh.bright_ti5 AS bright_ti5,
      dc.confidence_class AS confidence_class,
      ds.satellite_name AS satellite_name, ds.product AS product,
      dl.province_code AS province_code, dl.province_name AS province_name,
      dl.city_code AS city_code, dl.city_name AS city_name,
      dl.district_code AS district_code, dl.district_name AS district_name,
      dl.subdistrict_code AS subdistrict_code, dl.subdistrict_name AS subdistrict_name,
      COALESCE(fw.temperature, 0) AS temperature, COALESCE(fw.humidity, 0) AS humidity,
      COALESCE(fw.wind_speed, 0) AS wind_speed, COALESCE(fw.wind_degree, 0) AS wind_degree,
      COALESCE(fw.visibility, 0) AS visibility, COALESCE(fw.cloud_coverage, 0) AS cloud_coverage,
      COALESCE(fw.pressure, 0) AS pressure, COALESCE(fw.uv_index, 0) AS uv_index,
      COALESCE(fw.precipitation, 0) AS precipitation, COALESCE(fw.solar_radiation, 0) AS solar_radiation,
      COALESCE(dwc.conditions, '') AS weather_conditions, COALESCE(dwc.icon, '') AS weather_icon
    FROM (SELECT * FROM fact_hotspot WHERE id = ?) fh
    INNER JOIN dim_confidence dc ON fh.confidence_id = dc.id
    INNER JOIN dim_satellite ds ON fh.satellite_id = ds.id
    INNER JOIN dim_location dl ON fh.location_id = dl.id
    LEFT JOIN fact_weather fw ON fh.location_id = fw.location_id AND fh.period_id = fw.period_id
    LEFT JOIN dim_weather_condition dwc ON fw.weather_condition_id = dwc.id
    LIMIT 1`;
  const row = await db.prepare(sql).bind(id).first<HotspotDetail>();
  if (!row) return null;
  row.acquired_at = toRFC3339(row.acquired_at);
  row.id = btoa(row.id);
  return row;
}

export async function getTopProvinces(
  db: D1Database,
  start: Date | null,
  end: Date | null,
  limit: number,
): Promise<LocationCount[]> {
  const lo = dateBound(start, "0000-01-01");
  const hi = dateBound(end, "9999-12-31");
  const res = await db
    .prepare(
      `SELECT province_name AS name, SUM(cnt) AS count FROM agg_daily_province
       WHERE date_value >= ? AND date_value <= ?
       GROUP BY province_name HAVING name != '' ORDER BY count DESC LIMIT ?`,
    )
    .bind(lo, hi, limit)
    .all<LocationCount>();
  return res.results ?? [];
}

export async function getTopCities(
  db: D1Database,
  start: Date | null,
  end: Date | null,
  limit: number,
): Promise<LocationCount[]> {
  const lo = dateBound(start, "0000-01-01");
  const hi = dateBound(end, "9999-12-31");
  const res = await db
    .prepare(
      `SELECT city_name AS name, SUM(cnt) AS count FROM agg_daily_city
       WHERE date_value >= ? AND date_value <= ?
       GROUP BY city_name HAVING name != '' ORDER BY count DESC LIMIT ?`,
    )
    .bind(lo, hi, limit)
    .all<LocationCount>();
  return res.results ?? [];
}

export async function getMonthlyStats(
  db: D1Database,
  start: Date | null,
  end: Date | null,
  tz: string,
): Promise<MonthlyStats[]> {
  void tz; // rollups are bucketed by UTC date; tz month-boundary drift is negligible
  const lo = dateBound(start, "0000-01-01");
  const hi = dateBound(end, "9999-12-31");
  const res = await db
    .prepare(
      `SELECT substr(date_value, 1, 7) || '-01T00:00:00Z' AS month,
        SUM(cnt) AS total,
        COALESCE(SUM(CASE WHEN confidence_class = 'HIGH' THEN cnt ELSE 0 END), 0) AS high_confidence
       FROM agg_daily_province WHERE date_value >= ? AND date_value <= ?
       GROUP BY substr(date_value, 1, 7) ORDER BY month ASC`,
    )
    .bind(lo, hi)
    .all<MonthlyStats>();
  return res.results ?? [];
}

export async function getConfidenceDistribution(
  db: D1Database,
  start: Date | null,
  end: Date | null,
): Promise<DistributionCount[]> {
  const lo = dateBound(start, "0000-01-01");
  const hi = dateBound(end, "9999-12-31");
  const res = await db
    .prepare(
      `SELECT confidence_class AS name, SUM(cnt) AS count FROM agg_daily_confidence
       WHERE date_value >= ? AND date_value <= ? GROUP BY confidence_class ORDER BY count DESC`,
    )
    .bind(lo, hi)
    .all<DistributionCount>();
  return res.results ?? [];
}

export async function getSatelliteDistribution(
  db: D1Database,
  start: Date | null,
  end: Date | null,
): Promise<DistributionCount[]> {
  const lo = dateBound(start, "0000-01-01");
  const hi = dateBound(end, "9999-12-31");
  const res = await db
    .prepare(
      `SELECT satellite_name AS name, SUM(cnt) AS count FROM agg_daily_satellite
       WHERE date_value >= ? AND date_value <= ? GROUP BY satellite_name ORDER BY count DESC`,
    )
    .bind(lo, hi)
    .all<DistributionCount>();
  return res.results ?? [];
}

export async function getStats(
  db: D1Database,
  start: Date | null,
  end: Date | null,
): Promise<StatsResponse> {
  const lo = dateBound(start, "0000-01-01");
  const hi = dateBound(end, "9999-12-31");
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(cnt), 0) AS total_hotspots,
        COALESCE(SUM(CASE WHEN confidence_class = 'HIGH' THEN cnt ELSE 0 END), 0) AS high_confidence,
        COUNT(DISTINCT CASE WHEN cnt > 0 AND province_name != '' THEN province_code END) AS affected_provinces
       FROM agg_daily_province WHERE date_value >= ? AND date_value <= ?`,
    )
    .bind(lo, hi)
    .first<StatsResponse>();
  return row ?? { total_hotspots: 0, high_confidence: 0, affected_provinces: 0 };
}

export async function getTodayStats(
  db: D1Database,
  tz: string,
): Promise<TodayStatsResponse> {
  // "Today" is in the client's timezone. Data is stored UTC, so we compute the
  // UTC bounds of the tz-local day and filter on the indexed acquired_at range
  // (a ~1-day window, unlike a full-table date() scan). The rollup can't do this
  // because it is bucketed by UTC date and a tz day straddles two UTC dates.
  const offH = tzOffsetHours(tz || "UTC");
  const now = new Date();
  const tzNow = new Date(now.getTime() + offH * 3600000);
  const dayStartUtc = new Date(
    Date.UTC(tzNow.getUTCFullYear(), tzNow.getUTCMonth(), tzNow.getUTCDate()) - offH * 3600000,
  );
  const dayEndUtc = new Date(dayStartUtc.getTime() + 86400000);
  const sql = `SELECT count(*) AS today_hotspots,
      count(DISTINCT dl.province_name) AS today_affected_provinces,
      COALESCE(SUM(CASE WHEN dc.confidence_class = 'HIGH' THEN 1 ELSE 0 END), 0) AS today_high_confidence
    FROM fact_hotspot fh
    JOIN dim_confidence dc ON fh.confidence_id = dc.id
    JOIN dim_location dl ON fh.location_id = dl.id
    WHERE fh.acquired_at >= ? AND fh.acquired_at < ?`;
  const row = await db.prepare(sql).bind(toSqlTs(dayStartUtc), toSqlTs(dayEndUtc)).first<TodayStatsResponse>();
  return (
    row ?? {
      today_hotspots: 0,
      today_affected_provinces: 0,
      today_high_confidence: 0,
    }
  );
}

export async function getConfidenceList(db: D1Database): Promise<FilterOption[]> {
  const res = await db
    .prepare(
      "SELECT DISTINCT confidence_class AS id, confidence_class AS name FROM dim_confidence ORDER BY confidence_class",
    )
    .all<FilterOption>();
  return res.results ?? [];
}

export async function getSatelliteList(db: D1Database): Promise<FilterOption[]> {
  const res = await db
    .prepare(
      "SELECT DISTINCT satellite_name AS id, satellite_name AS name FROM dim_satellite ORDER BY satellite_name",
    )
    .all<FilterOption>();
  return res.results ?? [];
}

export async function getProductList(db: D1Database): Promise<FilterOption[]> {
  const res = await db
    .prepare(
      "SELECT DISTINCT product AS id, product AS name FROM dim_satellite WHERE product != '' ORDER BY product",
    )
    .all<FilterOption>();
  return res.results ?? [];
}

export async function getPeriods(
  db: D1Database,
  req: { year: number; semester: number; quarter: number; month: number },
): Promise<PeriodsResponse> {
  const { year, semester, quarter, month } = req;
  if (year === 0 && semester === 0 && quarter === 0 && month === 0) {
    const res = await db
      .prepare(
        "SELECT DISTINCT CAST(year_value AS TEXT) AS value, CAST(year_value AS TEXT) AS label FROM dim_period ORDER BY year_value DESC",
      )
      .all<{ value: string; label: string }>();
    return { years: res.results ?? [] };
  }
  if (year > 0 && semester === 0) {
    const res = await db
      .prepare(
        "SELECT DISTINCT CAST(semester_value AS TEXT) AS value, CAST(semester_value AS TEXT) AS label FROM dim_period WHERE year_value = ? ORDER BY semester_value",
      )
      .bind(year)
      .all<{ value: string; label: string }>();
    return { semesters: res.results ?? [] };
  }
  if (year > 0 && semester > 0 && quarter === 0) {
    const res = await db
      .prepare(
        "SELECT DISTINCT ('Q' || CAST(quarter_value AS TEXT)) AS value, ('Q' || CAST(quarter_value AS TEXT)) AS label FROM dim_period WHERE year_value = ? AND semester_value = ? ORDER BY quarter_value",
      )
      .bind(year, semester)
      .all<{ value: string; label: string }>();
    return { quarters: res.results ?? [] };
  }
  if (year > 0 && semester > 0 && quarter > 0 && month === 0) {
    const res = await db
      .prepare(
        "SELECT DISTINCT month_name AS value, month_name AS label FROM dim_period WHERE year_value = ? AND semester_value = ? AND quarter_value = ? ORDER BY month_value",
      )
      .bind(year, semester, quarter)
      .all<{ value: string; label: string }>();
    return { months: res.results ?? [] };
  }
  if (year > 0 && semester > 0 && quarter > 0 && month > 0) {
    const res = await db
      .prepare(
        "SELECT DISTINCT CAST(week_value AS TEXT) AS value, CAST(week_value AS TEXT) AS label FROM dim_period WHERE year_value = ? AND semester_value = ? AND quarter_value = ? AND month_value = ? ORDER BY week_value",
      )
      .bind(year, semester, quarter, month)
      .all<{ value: string; label: string }>();
    return { weeks: res.results ?? [] };
  }
  return {};
}

// Location-drilldown filters reference fh.* (aliased) columns.
function buildLocationFilters(f: HotspotFilters): { sql: string; args: unknown[] } {
  let sql = "";
  const args: unknown[] = [];
  if (f.startDate) { sql += " AND fh.acquired_at >= ?"; args.push(toSqlTs(f.startDate)); }
  if (f.endDate) { sql += " AND fh.acquired_at <= ?"; args.push(toSqlTs(f.endDate)); }
  if (f.satelliteId) {
    sql += " AND fh.satellite_id IN (SELECT id FROM dim_satellite WHERE satellite_name = ?)";
    args.push(f.satelliteId);
  }
  if (f.productId) {
    sql += " AND fh.satellite_id IN (SELECT id FROM dim_satellite WHERE product = ?)";
    args.push(f.productId);
  }
  if (f.confidenceId) {
    sql += " AND fh.confidence_id IN (SELECT id FROM dim_confidence WHERE confidence_class = ?)";
    args.push(f.confidenceId);
  }
  if (f.year > 0) { sql += " AND fh.period_id IN (SELECT id FROM dim_period WHERE year_value = ?)"; args.push(f.year); }
  if (f.semester > 0) { sql += " AND fh.period_id IN (SELECT id FROM dim_period WHERE semester_value = ?)"; args.push(f.semester); }
  if (f.quarter > 0) { sql += " AND fh.period_id IN (SELECT id FROM dim_period WHERE quarter_value = ?)"; args.push(f.quarter); }
  if (f.month > 0) { sql += " AND fh.period_id IN (SELECT id FROM dim_period WHERE month_value = ?)"; args.push(f.month); }
  if (f.week > 0) { sql += " AND fh.period_id IN (SELECT id FROM dim_period WHERE week_value = ?)"; args.push(f.week); }
  return { sql, args };
}

// Rollups carry date (+ confidence on the province rollup), so they can serve
// locations only when no satellite/product/period filter narrows the set.
function noRollupBreakingFilters(f: HotspotFilters): boolean {
  return (
    !f.satelliteId && !f.productId &&
    !f.year && !f.semester && !f.quarter && !f.month && !f.week
  );
}

export async function getLocations(
  db: D1Database,
  f: HotspotFilters,
): Promise<LocationsResponse> {
  const filters = buildLocationFilters(f);
  // Province rollup carries confidence_class; city rollup does not.
  const provinceRollup = noRollupBreakingFilters(f);
  const cityRollup = provinceRollup && !f.confidenceId;
  const lo = dateBound(f.startDate, "0000-01-01");
  const hi = dateBound(f.endDate, "9999-12-31");
  const base = (codeCol: string, nameCol: string) =>
    `SELECT ${codeCol} AS code, ${nameCol} AS name, count(*) AS count,
        avg(CAST(fh.latitude AS REAL)) AS lat, avg(CAST(fh.longitude AS REAL)) AS lng
     FROM fact_hotspot fh INNER JOIN dim_location dl ON fh.location_id = dl.id`;

  if (!f.provinceCode && !f.cityCode && !f.districtCode) {
    if (provinceRollup) {
      const confClause = f.confidenceId ? " AND confidence_class = ?" : "";
      const args = f.confidenceId ? [lo, hi, f.confidenceId] : [lo, hi];
      const res = await db
        .prepare(
          `SELECT province_code AS code, province_name AS name, SUM(cnt) AS count,
             SUM(sum_lat) / SUM(cnt) AS lat, SUM(sum_lng) / SUM(cnt) AS lng
           FROM agg_daily_province WHERE date_value >= ? AND date_value <= ?
             AND province_code != '' AND province_name != ''${confClause}
           GROUP BY province_code, province_name ORDER BY count DESC`,
        )
        .bind(...args)
        .all<LocationHierarchyItem>();
      return { provinces: res.results ?? [] };
    }
    const sql =
      base("dl.province_code", "dl.province_name") +
      " WHERE dl.province_code != '' AND dl.province_name != ''" +
      filters.sql +
      " GROUP BY dl.province_code, dl.province_name ORDER BY count DESC";
    const res = await db.prepare(sql).bind(...filters.args).all<LocationHierarchyItem>();
    return { provinces: res.results ?? [] };
  }
  if (f.provinceCode && !f.cityCode && !f.districtCode) {
    if (cityRollup) {
      const res = await db
        .prepare(
          `SELECT city_code AS code, city_name AS name, SUM(cnt) AS count,
             SUM(sum_lat) / SUM(cnt) AS lat, SUM(sum_lng) / SUM(cnt) AS lng
           FROM agg_daily_city WHERE date_value >= ? AND date_value <= ?
             AND province_code = ? AND city_code != '' AND city_name != ''
           GROUP BY city_code, city_name ORDER BY count DESC`,
        )
        .bind(lo, hi, f.provinceCode)
        .all<LocationHierarchyItem>();
      return { cities: res.results ?? [] };
    }
    const sql =
      base("dl.city_code", "dl.city_name") +
      " WHERE dl.province_code = ? AND dl.city_code != '' AND dl.city_name != ''" +
      filters.sql +
      " GROUP BY dl.city_code, dl.city_name ORDER BY count DESC";
    const res = await db.prepare(sql).bind(f.provinceCode, ...filters.args).all<LocationHierarchyItem>();
    return { cities: res.results ?? [] };
  }
  if (f.provinceCode && f.cityCode && !f.districtCode) {
    const sql =
      base("dl.district_code", "dl.district_name") +
      " WHERE dl.province_code = ? AND dl.city_code = ? AND dl.district_code != '' AND dl.district_name != ''" +
      filters.sql +
      " GROUP BY dl.district_code, dl.district_name ORDER BY count DESC";
    const res = await db.prepare(sql).bind(f.provinceCode, f.cityCode, ...filters.args).all<LocationHierarchyItem>();
    return { districts: res.results ?? [] };
  }
  // province + city + district -> subdistricts
  const sql =
    base("dl.subdistrict_code", "dl.subdistrict_name") +
    " WHERE dl.province_code = ? AND dl.city_code = ? AND dl.district_code = ? AND dl.subdistrict_code != '' AND dl.subdistrict_name != ''" +
    filters.sql +
    " GROUP BY dl.subdistrict_code, dl.subdistrict_name ORDER BY count DESC";
  const res = await db
    .prepare(sql)
    .bind(f.provinceCode, f.cityCode, f.districtCode, ...filters.args)
    .all<LocationHierarchyItem>();
  return { subdistricts: res.results ?? [] };
}
