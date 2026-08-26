#!/usr/bin/env python3
"""Export a subset of the local ClickHouse `hotspot` DB into D1-compatible SQL.

Dimensions are exported in full; the two fact tables are exported for a date
range (default: from START to the latest data) so the local D1 stays small for
parity testing. Timestamps come back from ClickHouse JSONEachRow already shaped
as "YYYY-MM-DD HH:MM:SS.SSS", which is exactly what the D1 schema expects.

Usage:
    python3 export_subset.py [START] [END]
    START/END are ISO dates, default START=2026-07-01, END=now.

Output: api-worker/seed/*.sql  (apply with wrangler d1 execute --file=...)
"""
import json
import os
import sys
import urllib.parse
import urllib.request

CH = "http://127.0.0.1:8123/"
DB = "hotspot"
OUT = os.path.join(os.path.dirname(__file__), "..", "seed")

# (table, columns in D1 order, select expression list)
DIMS = {
    "dim_location": [
        "id", "province_code", "province_name", "city_code", "city_name",
        "district_code", "district_name", "subdistrict_code", "subdistrict_name",
    ],
    "dim_period": [
        "id", "toString(date_value) AS date_value", "year_value", "semester_value",
        "quarter_value", "month_value", "month_name", "week_value",
    ],
    "dim_satellite": [
        "id", "satellite_name", "instrument", "product", "version",
        "spatial_resolution_m", "temporal_resolution_hours", "description",
    ],
    "dim_confidence": [
        "id", "confidence_raw", "source_instrument", "confidence_class",
        "confidence_numeric", "confidence_score", "description",
    ],
    "dim_weather_condition": ["id", "conditions", "icon"],
}

FACT_HOTSPOT = [
    "id", "satellite_id", "confidence_id", "period_id", "location_id",
    "toString(acquired_at) AS acquired_at", "frp", "brightness",
    "latitude", "longitude", "scan", "track", "bright_t31", "bright_ti4", "bright_ti5",
]
FACT_WEATHER = [
    "id", "period_id", "location_id", "weather_condition_id",
    "toString(acquired_at) AS acquired_at", "temperature", "humidity",
    "wind_speed", "wind_degree", "visibility", "cloud_coverage",
    "latitude", "longitude", "pressure", "uv_index", "precipitation", "solar_radiation",
]


def col_name(expr):
    return expr.split(" AS ")[-1].strip() if " AS " in expr else expr


def ch_query(sql):
    url = CH + "?" + urllib.parse.urlencode({"database": DB})
    req = urllib.request.Request(url, data=sql.encode(), method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read().decode()


def sqlite_lit(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def export_table(table, select_exprs, where=""):
    cols = [col_name(e) for e in select_exprs]
    sql = f"SELECT {', '.join(select_exprs)} FROM {table} {where} FORMAT JSONEachRow"
    raw = ch_query(sql)
    rows = [json.loads(line) for line in raw.splitlines() if line.strip()]
    path = os.path.join(OUT, f"{table}.sql")
    n = 0
    with open(path, "w") as f:
        f.write(f"DELETE FROM {table};\n")
        BATCH = 400
        for i in range(0, len(rows), BATCH):
            chunk = rows[i : i + BATCH]
            values = ",\n".join(
                "(" + ",".join(sqlite_lit(row.get(c)) for c in cols) + ")"
                for row in chunk
            )
            f.write(f"INSERT INTO {table} ({', '.join(cols)}) VALUES\n{values};\n")
            n += len(chunk)
    print(f"  {table}: {n} rows -> {os.path.relpath(path)}")
    return n


GEO_CACHE = ["latitude", "longitude", "location_id"]


def main():
    # Usage: export_subset.py [START|full] [END]
    #   START=full  -> export ALL fact rows (no date filter) + geo_coordinate_cache
    arg1 = sys.argv[1] if len(sys.argv) > 1 else "2026-07-01"
    end = sys.argv[2] if len(sys.argv) > 2 else None
    full = arg1.lower() == "full"
    os.makedirs(OUT, exist_ok=True)

    if full:
        where = ""
        print("Exporting FULL: all dims + all facts + geo_coordinate_cache")
    else:
        rng = f"acquired_at >= '{arg1} 00:00:00'"
        if end:
            rng += f" AND acquired_at <= '{end} 23:59:59'"
        where = f"WHERE {rng}"
        print(f"Exporting dims (full) + facts ({arg1}..{end or 'now'})")

    for table, exprs in DIMS.items():
        export_table(table, exprs)
    export_table("fact_hotspot", FACT_HOTSPOT, where)
    export_table("fact_weather", FACT_WEATHER, where)
    if full:
        export_table("geo_coordinate_cache", GEO_CACHE)
    print("Done. Apply with: wrangler d1 execute hotspot --local --file=seed/<table>.sql")


if __name__ == "__main__":
    main()
