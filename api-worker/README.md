# hotspot-api-worker

Cloudflare Workers + Hono port of the Go REST API (`../api`).
Replaces ClickHouse with **D1**, Redis with **KV**, and adds an **R2** binding for storage.

## Stack

| Concern | Old (`api/`) | New (this) |
|---|---|---|
| Runtime | Go 1.24 + chi | Workers + Hono |
| OLAP store | ClickHouse | D1 (SQLite) |
| Cache | Redis | KV (versioned keys) |
| Object storage | - | R2 |

The galaxy schema (2 facts + 5 conformed dims) is mirrored in `migrations/0001_init.sql`.

## Endpoints (parity with Go)

Base: `/api/v1/hotspots`

- `GET /` - paginated raw detections (reads `limit` only, like the Go handler)
- `GET /geojson` - GeoJSON FeatureCollection, cursor pagination + all filters
- `GET /summary` - dashboard aggregates (top provinces/cities, distributions, stats, monthly, today)
- `GET /filter-options` - distinct confidence / satellite / product
- `GET /periods` - drill-down year -> semester -> quarter -> month -> week
- `GET /locations` - island-grouped provinces, or cities/districts/subdistricts drill-down
- `GET /health` - liveness + D1 check

Response envelope matches Go: `{ message, success, data }`.

## Local development

```bash
pnpm install
pnpm db:migrate:local                       # apply schema to local D1
wrangler d1 execute hotspot --local --file=seed/smoke_seed.sql   # tiny test data
pnpm dev                                     # http://127.0.0.1:8787
```

### Load a real-data subset from local ClickHouse

With the local ClickHouse `hotspot` DB reachable at `http://127.0.0.1:8123`:

```bash
python3 scripts/export_subset.py 2026-07-01           # dims full + facts >= date
for t in dim_location dim_period dim_satellite dim_confidence dim_weather_condition fact_hotspot fact_weather; do
  wrangler d1 execute hotspot --local --file=seed/$t.sql
done
```

## Deploy (remote)

```bash
wrangler login
wrangler d1 create hotspot                   # put the id into wrangler.jsonc
wrangler kv namespace create CACHE           # put the id into wrangler.jsonc
wrangler r2 bucket create hotspot-storage
pnpm db:migrate:remote
pnpm deploy
```

## Notes

- Timestamps are stored as `YYYY-MM-DD HH:MM:SS.SSS` TEXT so lexicographic order == chronological order (keyset pagination).
- SQLite has no timezone DB; the handful of IANA zones used (Asia/Jakarta, Makassar, Jayapura, UTC) map to fixed hour offsets in `src/lib/geo.ts`.
- Cache invalidation uses a version prefix in KV (`__cache_version__`); the ETL bumps it when new data lands (see `src/lib/cache.ts` `bumpVersion`).
