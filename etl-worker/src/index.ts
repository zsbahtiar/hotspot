// Cloudflare Cron Worker: decoupled hotspot ETL.
//
// Two schedules (routed by event.cron):
//   ingest  ("*/15 * * * *") - NASA FIRMS -> geocode -> load fact_hotspot NOW.
//                              Weather is NOT fetched here.
//   weather ("*/5 * * * *")  - derive the (location_id, period_id) pairs that
//                              still lack weather (recent window), fetch VC within
//                              the free budget (1000 records/day), write fact_weather.
//
// There is no queue table: the "pending" set is derived from the data itself
// (hotspots whose location+period has no fact_weather row). Weather is optional,
// so the API LEFT JOINs it and hotspots appear immediately.
import { fetchAllFirms } from "./firms";
import { Geocoder } from "./geocode";
import { fetchWeather } from "./weather";
import { transform, buildWeatherFacts } from "./transform";
import {
  load,
  fetchMissingWeather,
  budgetUsed,
  addBudget,
  loadWeatherFacts,
  refreshRollups,
} from "./load";
import { log, setLevel } from "./log";

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  NASA_FIRMS_BASE_URL: string;
  NASA_FIRMS_API_KEY: string;
  INDONESIA_BBOX: string;
  FIRMS_SOURCES: string;
  BMKG_API_BASE_URL: string;
  BMKG_REFERER: string;
  BMKG_ORIGIN: string;
  BMKG_API_KEY?: string;
  VISUALCROSSING_BASE_URL: string;
  VISUALCROSSING_API_KEY?: string;
  WEATHER_DAILY_BUDGET: string; // e.g. "1000"
  WEATHER_BATCH: string; // per-run cap, e.g. "40"
  WEATHER_WINDOW_DAYS: string; // how far back to look for missing weather, e.g. "30"
  LOG_LEVEL?: string; // error | warn | info | debug
  ETL_TOKEN?: string;
}

const INGEST_CRON = "*/15 * * * *";
const WEATHER_CRON = "*/5 * * * *";

function utcDateKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

// ---------- Ingest: hotspots now, weather later ----------
async function runIngest(env: Env) {
  const hotspots = await fetchAllFirms(env);
  if (hotspots.length === 0) return { phase: "ingest", hotspots_fetched: 0 };

  const geocoder = new Geocoder(env.DB);
  await geocoder.preloadLocations();
  const locationByCoord = await geocoder.resolve(
    hotspots.map((h) => ({ lat: h.latitude, lng: h.longitude })),
  );

  // Weather is intentionally NOT fetched here (empty array); the backfill schedule
  // will enrich these hotspots later.
  const t = await transform(env.DB, hotspots, locationByCoord, []);
  const counts = await load(env.DB, env.CACHE, geocoder.newLocations, t);

  // Keep the summary rollups current for the dates we just ingested.
  const dates = [...new Set(hotspots.map((h) => h.acq_date))];
  await refreshRollups(env.DB, dates);

  return { phase: "ingest", hotspots_fetched: hotspots.length, ...counts, rollup_dates: dates.length };
}

// ---------- Weather backfill: throttled to the free budget ----------
async function runWeatherBackfill(env: Env) {
  if (!env.VISUALCROSSING_API_KEY) return { phase: "weather", skipped: "no VC key" };

  const dateKey = utcDateKey();
  // WEATHER_DAILY_BUDGET: >0 caps VisualCrossing usage per UTC day (free plan);
  // 0 (or empty) disables the cap entirely (paid plan / unlimited).
  const daily = parseInt(env.WEATHER_DAILY_BUDGET || "1000", 10);
  const capped = daily > 0;
  const perRun = parseInt(env.WEATHER_BATCH || "40", 10);
  const windowDays = parseInt(env.WEATHER_WINDOW_DAYS || "7", 10);
  const used = capped ? await budgetUsed(env.CACHE, dateKey) : 0;
  const remaining = capped ? daily - used : Number.POSITIVE_INFINITY;
  if (remaining <= 0) return { phase: "weather", budget_exhausted: true, used };

  const since = new Date(Date.now() - windowDays * 86400000);
  const sinceIso = `${utcDateKey(since)} 00:00:00.000`;
  const take = capped ? Math.min(remaining, perRun) : perRun;
  const jobs = await fetchMissingWeather(env.DB, sinceIso, take);
  if (jobs.length === 0) return { phase: "weather", pending: 0 };

  const weatherRows = [];
  let calls = 0;
  let failed = 0;
  for (const j of jobs) {
    calls++;
    try {
      const w = await fetchWeather(env, j.latitude, j.longitude, j.date_value);
      if (w) weatherRows.push(w);
      else failed++;
    } catch (e) {
      log.warn("weather fetch failed", { lat: j.latitude, lng: j.longitude, date: j.date_value, error: String(e) });
      failed++;
    }
  }

  const { factWeather, newWeatherConditions } = await buildWeatherFacts(env.DB, weatherRows, jobs);
  const res = await loadWeatherFacts(env.DB, env.CACHE, newWeatherConditions, factWeather);
  if (capped) await addBudget(env.CACHE, dateKey, calls); // count VC calls only when capping

  return { phase: "weather", capped, processed: jobs.length, ...res, failed, budget_used: capped ? used + calls : null };
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    setLevel(env.LOG_LEVEL);
    const run = event.cron === WEATHER_CRON ? runWeatherBackfill : runIngest;
    log.info("cron fired", { cron: event.cron });
    ctx.waitUntil(
      run(env)
        .then((r) => log.info("ETL complete", r))
        .catch((e) => log.error("ETL failed", { error: String(e) })),
    );
  },

  // The ETL runs automatically from the cron triggers above. This handler is only
  // an optional manual trigger for testing/on-demand runs, locked by ETL_TOKEN.
  //   POST /run?mode=ingest|weather        -> blocks, returns the result JSON
  //   POST /run?mode=ingest|weather&async=1 -> returns immediately, runs in background
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    setLevel(env.LOG_LEVEL);
    const url = new URL(req.url);
    if (req.method === "POST" && url.pathname === "/run") {
      if (!env.ETL_TOKEN || req.headers.get("X-ETL-Token") !== env.ETL_TOKEN) {
        return Response.json({ success: false, error: "unauthorized" }, { status: 401 });
      }
      const mode = url.searchParams.get("mode") ?? "ingest";
      const runner = () => (mode === "weather" ? runWeatherBackfill(env) : runIngest(env));
      if (url.searchParams.get("async") === "1") {
        log.info("manual run (async)", { mode });
        ctx.waitUntil(
          runner()
            .then((r) => log.info("ETL complete", r))
            .catch((e) => log.error("ETL failed", { error: String(e) })),
        );
        return Response.json({ success: true, started: true, mode });
      }
      try {
        log.info("manual run", { mode });
        const result = await runner();
        log.info("ETL complete", result);
        return Response.json({ success: true, result });
      } catch (e) {
        log.error("ETL failed", { error: String(e) });
        return Response.json({ success: false, error: String(e) }, { status: 500 });
      }
    }
    if (url.pathname === "/health") return Response.json({ status: "ok" });
    return new Response("hotspot-etl: POST /run?mode=ingest|weather[&async=1] (X-ETL-Token)", { status: 404 });
  },
};
