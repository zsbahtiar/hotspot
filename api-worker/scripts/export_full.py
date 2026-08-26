#!/usr/bin/env python3
"""Robust, resumable export of the full ClickHouse `hotspot` DB to D1 SQL files.

Designed for a flaky link to the ClickHouse VM: every table is exported in small
independent chunks (facts by month, big dims by row offset), each chunk retries
with backoff, and finished chunk files are skipped so you can just re-run until
everything is present. Run it locally over an SSH/localhost tunnel to :8123, or
directly on the VM (then upload seed/full/ to R2 and pull it down).

Env:
  CH_URL   ClickHouse HTTP endpoint (default http://127.0.0.1:8123)
  CH_DB    database (default hotspot)

Output: api-worker/seed/full/*.sql   (import with wrangler d1 import, see below)

Import (after export completes):
  cd api-worker
  wrangler d1 execute hotspot --remote --file=seed/full/00_reset.sql
  for f in seed/full/dim_*.sql seed/full/geo_*.sql seed/full/fact_*.sql; do
    wrangler d1 import hotspot --remote --file="$f" || break
  done
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

CH = os.environ.get("CH_URL", "http://127.0.0.1:8123").rstrip("/")
DB = os.environ.get("CH_DB", "hotspot")
OUT = os.path.join(os.path.dirname(__file__), "..", "seed", "full")

DIM_SMALL = {
    "dim_period": ["id", "toString(date_value) AS date_value", "year_value", "semester_value", "quarter_value", "month_value", "month_name", "week_value"],
    "dim_satellite": ["id", "satellite_name", "instrument", "product", "version", "spatial_resolution_m", "temporal_resolution_hours", "description"],
    "dim_confidence": ["id", "confidence_raw", "source_instrument", "confidence_class", "confidence_numeric", "confidence_score", "description"],
    "dim_weather_condition": ["id", "conditions", "icon"],
}
DIM_LOCATION = ["id", "province_code", "province_name", "city_code", "city_name", "district_code", "district_name", "subdistrict_code", "subdistrict_name"]
GEO_CACHE = ["latitude", "longitude", "location_id"]
FACT_HOTSPOT = ["id", "satellite_id", "confidence_id", "period_id", "location_id", "toString(acquired_at) AS acquired_at", "frp", "brightness", "latitude", "longitude", "scan", "track", "bright_t31", "bright_ti4", "bright_ti5"]
FACT_WEATHER = ["id", "period_id", "location_id", "weather_condition_id", "toString(acquired_at) AS acquired_at", "temperature", "humidity", "wind_speed", "wind_degree", "visibility", "cloud_coverage", "latitude", "longitude", "pressure", "uv_index", "precipitation", "solar_radiation"]

ALL_TABLES = ["dim_location", "dim_period", "dim_satellite", "dim_confidence", "dim_weather_condition", "geo_coordinate_cache", "fact_hotspot", "fact_weather"]


def col_name(expr):
    return expr.split(" AS ")[-1].strip() if " AS " in expr else expr


def ch(sql, retries=6):
    url = CH + "/?" + urllib.parse.urlencode({"database": DB})
    delay = 2.0
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=sql.encode(), method="POST")
            with urllib.request.urlopen(req, timeout=300) as r:
                return r.read().decode()
        except Exception as e:
            if attempt == retries - 1:
                raise
            print(f"    retry {attempt + 1} after error: {e}")
            time.sleep(delay)
            delay = min(delay * 1.8, 30)


def lit(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def write_chunk(path, table, cols, rows):
    with open(path, "w") as f:
        BATCH = 400
        for i in range(0, len(rows), BATCH):
            chunk = rows[i : i + BATCH]
            values = ",\n".join("(" + ",".join(lit(row.get(c)) for c in cols) + ")" for row in chunk)
            f.write(f"INSERT INTO {table} ({', '.join(cols)}) VALUES\n{values};\n")


def export_query(source, select_exprs, where, out_name, insert_table=None):
    # `source` is the FROM clause for reading (may be a subquery);
    # `insert_table` is the real table the generated INSERT targets.
    insert_table = insert_table or source
    path = os.path.join(OUT, out_name)
    if os.path.exists(path) and os.path.getsize(path) > 0:
        print(f"  skip {out_name} (exists)")
        return
    cols = [col_name(e) for e in select_exprs]
    sql = f"SELECT {', '.join(select_exprs)} FROM {source} {where} FORMAT JSONEachRow"
    raw = ch(sql)
    rows = [json.loads(l) for l in raw.splitlines() if l.strip()]
    write_chunk(path + ".part", insert_table, cols, rows)
    os.replace(path + ".part", path)
    print(f"  {out_name}: {len(rows)} rows")


def count(table, where=""):
    return int(ch(f"SELECT count() FROM {table} {where} FORMAT TSV").strip() or "0")


def export_hashed(table, cols, key_expr, num_chunks):
    # Deterministic single-pass chunking (no OFFSET rescans, no ORDER BY needed).
    total = count(table)
    print(f"{table}: {total} rows in {num_chunks} hash chunks")
    for i in range(num_chunks):
        export_query(table, cols, f"WHERE cityHash64({key_expr}) % {num_chunks} = {i}", f"{table}-{i:04d}.sql")


def export_months(table, cols):
    rng = ch(f"SELECT toYYYYMM(min(acquired_at)), toYYYYMM(max(acquired_at)) FROM {table} FORMAT TSV").strip().split("\t")
    lo, hi = int(rng[0]), int(rng[1])
    print(f"{table}: months {lo}..{hi}")
    ym = lo
    while ym <= hi:
        # Filter in a subquery so the toString(acquired_at) AS acquired_at alias
        # does not shadow the real DateTime column in the WHERE clause.
        src = f"(SELECT * FROM {table} WHERE toYYYYMM(acquired_at) = {ym})"
        export_query(src, cols, "", f"{table}-{ym}.sql", insert_table=table)
        y, m = ym // 100, ym % 100
        ym = (y + 1) * 100 + 1 if m == 12 else ym + 1


def write_reset():
    path = os.path.join(OUT, "00_reset.sql")
    with open(path, "w") as f:
        for t in ALL_TABLES:
            f.write(f"DELETE FROM {t};\n")
    print("  00_reset.sql")


def main():
    os.makedirs(OUT, exist_ok=True)
    only = sys.argv[1] if len(sys.argv) > 1 else "all"
    write_reset()
    if only in ("all", "dims"):
        for table, exprs in DIM_SMALL.items():
            export_query(table, exprs, "", f"{table}.sql")
        export_hashed("dim_location", DIM_LOCATION, "id", 4)
    if only in ("all", "geo"):
        export_hashed("geo_coordinate_cache", GEO_CACHE, "concat(latitude,'|',longitude)", 60)
    if only in ("all", "facts"):
        export_months("fact_hotspot", FACT_HOTSPOT)
        export_months("fact_weather", FACT_WEATHER)
    print("Done. See header for the wrangler d1 import loop.")


if __name__ == "__main__":
    main()
