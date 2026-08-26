# Migration: self-hosted stack -> Cloudflare serverless

Moves the OLAP hotspot system off Go + ClickHouse + Redis + Airflow (Docker) onto
the Cloudflare stack, keeping the Astro dashboard and all API contracts unchanged.

## Mapping

| Old | New | Where |
|---|---|---|
| Go REST API (`api/`) | Workers + Hono | `api-worker/` |
| ClickHouse galaxy schema | D1 (SQLite) | `api-worker/migrations/` |
| Redis cache | KV (versioned keys) | `api-worker/src/lib/cache.ts` |
| Airflow `hotspot_daily` ETL (`de/`) | Cron Worker | `etl-worker/` |
| (new) object storage | R2 | `BUCKET` binding |
| Astro dashboard (`app/`) | unchanged | just repoint `PUBLIC_API_URL` |

Data model is preserved 1:1: `fact_hotspot`, `fact_weather` + `dim_location`,
`dim_period`, `dim_satellite`, `dim_confidence`, `dim_weather_condition`, plus
`geo_coordinate_cache` used by the ETL.

## Scale (from local ClickHouse)

- fact_hotspot: ~4.86M rows, fact_weather: ~4.9M rows (2015-2026)
- dim_location: 63,671; dim_period: 4,251; other dims tiny
- Fits within D1's 10 GB limit. Heavy aggregations are cached (2-24h) and
  invalidated by the ETL, so live compute is amortised.

## One-time setup (Cloudflare account)

```bash
wrangler login
wrangler d1 create hotspot            # -> put database_id into BOTH wrangler.jsonc files
wrangler kv namespace create CACHE    # -> put id into BOTH wrangler.jsonc files
wrangler r2 bucket create hotspot-storage

cd api-worker && pnpm i && pnpm db:migrate:remote   # applies 0001 + 0002
```

## Data import (needs local ClickHouse running on :8123)

```bash
cd api-worker
python3 scripts/export_subset.py full           # dumps all dims + all facts + geo cache to seed/
# apply locally to test:
for t in dim_location dim_period dim_satellite dim_confidence dim_weather_condition fact_hotspot fact_weather geo_coordinate_cache; do
  wrangler d1 execute hotspot --local --file=seed/$t.sql
done
# or to remote D1 (bulk):
for t in ...; do wrangler d1 execute hotspot --remote --file=seed/$t.sql; done
```

Note: 10M rows is a large import; run it table by table and expect it to take a
while. A `subset` export (`export_subset.py 2026-07-01`) is available for quick
parity testing.

## Deploy

```bash
cd api-worker && pnpm deploy
cd ../etl-worker && pnpm i
wrangler secret put NASA_FIRMS_API_KEY
wrangler secret put VISUALCROSSING_API_KEY
wrangler secret put ETL_TOKEN
pnpm deploy
```

## Point the dashboard at the Worker

```
# app/.env.production
PUBLIC_API_URL=https://hotspot-api.<your-subdomain>.workers.dev
```

The Astro app calls `${PUBLIC_API_URL}/api/v1/hotspots/...`, which the Worker serves
with identical response shapes, so no frontend code changes are required.

## Status

- `api-worker` - all 6 endpoints ported and validated locally against a smoke dataset.
- `etl-worker` - full pipeline ported, typechecked. Not yet run end-to-end (needs
  NASA FIRMS + VisualCrossing keys and a live BMKG).
- Remaining: real-data import (needs ClickHouse up), remote resource creation +
  deploy (needs `wrangler login`).
