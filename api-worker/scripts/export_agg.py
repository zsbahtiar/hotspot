#!/usr/bin/env python3
"""Compute the daily rollups in ClickHouse (fast, columnar) and emit D1 SQL.

Run on the ClickHouse host (or over a tunnel). Output: seed/agg/*.sql, imported
into D1 with wrangler d1 execute --file. City is chunked by year (~434k rows).
"""
import json
import os
import urllib.request

CH = os.environ.get("CH_URL", "http://127.0.0.1:8123").rstrip("/")
DB = os.environ.get("CH_DB", "hotspot")
OUT = os.path.join(os.path.dirname(__file__), "..", "seed", "agg")


def ch(sql):
    req = urllib.request.Request(CH + f"/?database={DB}", data=sql.encode(), method="POST")
    with urllib.request.urlopen(req, timeout=300) as r:
        return r.read().decode()


def lit(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def dump(table, cols, sql, out_name):
    path = os.path.join(OUT, out_name)
    if os.path.exists(path) and os.path.getsize(path) > 0:
        print(f"  skip {out_name}")
        return
    rows = [json.loads(l) for l in ch(sql + " FORMAT JSONEachRow").splitlines() if l.strip()]
    with open(path + ".part", "w") as f:
        B = 400
        for i in range(0, len(rows), B):
            chunk = rows[i : i + B]
            values = ",\n".join("(" + ",".join(lit(row.get(c)) for c in cols) + ")" for row in chunk)
            f.write(f"INSERT INTO {table} ({', '.join(cols)}) VALUES\n{values};\n")
    os.replace(path + ".part", path)
    print(f"  {out_name}: {len(rows)} rows")


def main():
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "00_reset.sql"), "w") as f:
        for t in ("agg_daily_province", "agg_daily_city", "agg_daily_satellite", "agg_daily_confidence"):
            f.write(f"DELETE FROM {t};\n")

    dump(
        "agg_daily_province",
        ["date_value", "province_code", "province_name", "confidence_class", "cnt", "sum_lat", "sum_lng"],
        """SELECT toString(toDate(fh.acquired_at)) AS date_value, dl.province_code, dl.province_name,
            dc.confidence_class AS confidence_class,
            count(*) AS cnt,
            sum(toFloat64(fh.latitude)) AS sum_lat, sum(toFloat64(fh.longitude)) AS sum_lng
           FROM fact_hotspot fh
           JOIN dim_location dl ON fh.location_id=dl.id
           JOIN dim_confidence dc ON fh.confidence_id=dc.id
           GROUP BY date_value, dl.province_code, dl.province_name, dc.confidence_class""",
        "agg_daily_province.sql",
    )

    # City is larger; chunk by year.
    yrs = [int(y) for y in ch("SELECT DISTINCT toYear(acquired_at) FROM fact_hotspot ORDER BY 1 FORMAT TSV").split()]
    for y in yrs:
        dump(
            "agg_daily_city",
            ["date_value", "province_code", "city_code", "city_name", "cnt", "sum_lat", "sum_lng"],
            f"""SELECT toString(toDate(fh.acquired_at)) AS date_value, dl.province_code, dl.city_code, dl.city_name,
                count(*) AS cnt, sum(toFloat64(fh.latitude)) AS sum_lat, sum(toFloat64(fh.longitude)) AS sum_lng
               FROM fact_hotspot fh
               JOIN dim_location dl ON fh.location_id=dl.id
               WHERE toYear(fh.acquired_at)={y}
               GROUP BY date_value, dl.province_code, dl.city_code, dl.city_name""",
            f"agg_daily_city-{y}.sql",
        )

    dump(
        "agg_daily_satellite",
        ["date_value", "satellite_name", "cnt"],
        """SELECT toString(toDate(fh.acquired_at)) AS date_value, ds.satellite_name, count(*) AS cnt
           FROM fact_hotspot fh JOIN dim_satellite ds ON fh.satellite_id=ds.id
           GROUP BY date_value, ds.satellite_name""",
        "agg_daily_satellite.sql",
    )
    dump(
        "agg_daily_confidence",
        ["date_value", "confidence_class", "cnt"],
        """SELECT toString(toDate(fh.acquired_at)) AS date_value, dc.confidence_class, count(*) AS cnt
           FROM fact_hotspot fh JOIN dim_confidence dc ON fh.confidence_id=dc.id
           GROUP BY date_value, dc.confidence_class""",
        "agg_daily_confidence.sql",
    )
    print("Done.")


if __name__ == "__main__":
    main()
