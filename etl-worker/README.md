# hotspot-etl-worker

Cloudflare **Cron Worker** port of the Airflow `hotspot_daily` ETL (`de/`).
Runs every 15 minutes, writing into the **same D1 database and KV namespace** as `api-worker`.

## Two decoupled schedules (routed by `event.cron`)

Weather is NOT fetched on the ingest path (it is slow and rate-limited on the
VisualCrossing free plan). Ingest loads hotspots immediately and enqueues weather
jobs; a separate throttled schedule drains the queue.

### Ingest (`*/15 * * * *`, or `POST /run?mode=ingest`)
1. **FIRMS** - fetch recent detections for the Indonesia bbox across `FIRMS_SOURCES` (MODIS + VIIRS NRT).
2. **Geocode** - resolve each unique `(lat,lng)` to a `location_id` via D1 `geo_coordinate_cache`, else BMKG `/coord` -> upsert `dim_location`.
3. **Transform + Load** - build dims + `fact_hotspot` (no weather), `INSERT OR IGNORE` into D1, bump `__cache_version__`.

### Weather backfill (`*/5 * * * *`, or `POST /run?mode=weather`)
There is **no queue table**. The pending set is derived from the data: any
`(location_id, period_id)` that has hotspots but no `fact_weather` row, within the
last `WEATHER_WINDOW_DAYS` (30). Writing a `fact_weather` row is what removes an
item from that set, so no bookkeeping is needed.

- Reads a daily counter in KV (`wbudget:<UTC-date>`); stops once `WEATHER_DAILY_BUDGET` (1000) is reached.
- Picks up to `WEATHER_BATCH` missing `(location_id, period_id)` pairs (recent first, one representative coord each), fetches the VisualCrossing daily aggregate (1 record per call), writes `fact_weather` + `dim_weather_condition`, bumps the cache.
- Runs with **no VC key** cleanly (skips). Coordinates VisualCrossing cannot resolve are simply retried on a later run (rare for valid Indonesian points).

The API `/` and `/geojson` use a LEFT JOIN on `fact_weather`, so hotspots appear
immediately with empty weather fields and get enriched later. Fact/dim ids are
derived from natural keys, so all writes are idempotent.

## Secrets

```bash
wrangler secret put NASA_FIRMS_API_KEY      # required
wrangler secret put VISUALCROSSING_API_KEY  # weather (optional but needed for fact_weather)
wrangler secret put BMKG_API_KEY            # optional X-Api-Key
wrangler secret put ETL_TOKEN               # guards POST /run
```

## Run / test

```bash
pnpm install
pnpm typecheck
# manual trigger (after deploy or in `wrangler dev`):
curl -X POST https://hotspot-etl.<subdomain>.workers.dev/run -H "X-ETL-Token: $ETL_TOKEN"
```

## Deploy

```bash
# uses the same D1 id + KV id as api-worker (put them in wrangler.jsonc first)
pnpm deploy
```

## Parity notes vs the Python ETL

- **fact_weather requires a VisualCrossing key.** Without it, new hotspots load but the API `/` list and `/geojson` (which INNER JOIN fact_weather) will not show them until weather exists; `/summary` and `/locations` still count them.
- Geocoding uses the BMKG online `/coord` endpoint (the offline DuckDB point-in-polygon geocoder cannot run on Workers). Existing coordinates are served from `geo_coordinate_cache`, so BMKG is only hit for genuinely new points.
- Weather visibility/units are passed through from VisualCrossing metric values as the Python did (no unit conversion).
