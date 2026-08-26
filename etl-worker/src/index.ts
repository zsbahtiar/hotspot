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
  WEATHER_HISTORY_FROM_YEAR?: string; // earliest year the historical sweep backfills, e.g. "2015"
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
  await geocoder.preloadBoundaries();
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
  const liveSinceIso = `${utcDateKey(since)} 00:00:00.000`;
  // Each job is one VisualCrossing subrequest; cap per-run work so a large
  // WEATHER_BATCH (paid/unlimited mode) can't blow the 1000 subrequest/invocation limit.
  const SUBREQ_SAFE_MAX = 700;
  const take = Math.min(capped ? Math.min(remaining, perRun) : perRun, SUBREQ_SAFE_MAX);

  // Fresh data first: fill the recent window before touching history.
  const liveJobs = await fetchMissingWeather(env.DB, liveSinceIso, take);
  if (liveJobs.length > 0) {
    const r = await processWeatherJobs(env, liveJobs, capped, used, dateKey);
    return { phase: "weather", scope: "live", capped, processed: liveJobs.length, ...r };
  }

  // Window is clean -> sweep the historical tail one bounded year-slice per run.
  return await runHistoricalSweep(env, liveSinceIso, take, capped, used, dateKey);
}

// Fetch VisualCrossing for each job (sequential; VC rate-limits), then write
// dim_weather_condition + fact_weather and bump the budget counter when capping.
async function processWeatherJobs(
  env: Env,
  jobs: Awaited<ReturnType<typeof fetchMissingWeather>>,
  capped: boolean,
  used: number,
  dateKey: string,
) {
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
  return { ...res, failed, budget_used: capped ? used + calls : null };
}

// Backfills the pre-window tail (old hotspots that never got weather) one year at
// a time, bounded so each run's anti-join stays cheap. A KV cursor advances past
// each cleared year; once it passes the current year the sweep is done and idle.
async function runHistoricalSweep(
  env: Env,
  liveSinceIso: string,
  take: number,
  capped: boolean,
  used: number,
  dateKey: string,
) {
  const fromYear = parseInt(env.WEATHER_HISTORY_FROM_YEAR || "2015", 10);
  const nowYear = new Date().getUTCFullYear();
  const cursor = await env.CACHE.get("whist:year");
  let year = cursor ? parseInt(cursor, 10) : fromYear;
  if (!Number.isFinite(year) || year < fromYear) year = fromYear;
  if (year > nowYear) return { phase: "weather", scope: "history", done: true };

  const sliceSince = `${year}-01-01 00:00:00.000`;
  let sliceUntil = `${year + 1}-01-01 00:00:00.000`;
  if (sliceUntil > liveSinceIso) sliceUntil = liveSinceIso; // never overlap the live window

  const jobs =
    sliceSince < sliceUntil
      ? await fetchMissingWeather(env.DB, sliceSince, take, sliceUntil)
      : [];
  if (jobs.length === 0) {
    await env.CACHE.put("whist:year", String(year + 1)); // year clean -> advance
    return { phase: "weather", scope: "history", year, cleared: true, next: year + 1 };
  }
  const r = await processWeatherJobs(env, jobs, capped, used, dateKey);
  // If the whole slice fit in one run, the year is fully attempted -> advance so a
  // permanently-unresolvable pair (e.g. no VC data) can never stall the sweep.
  const exhausted = jobs.length < take;
  if (exhausted) await env.CACHE.put("whist:year", String(year + 1));
  return { phase: "weather", scope: "history", year, processed: jobs.length, advanced: exhausted, ...r };
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
