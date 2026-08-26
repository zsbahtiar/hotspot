#!/usr/bin/env python3
"""Extract village boundaries from the DuckDB geocoder into D1-compatible SQL.

Emits geo_boundary rows (hierarchy + simplified GeoJSON polygon) and geo_rtree
rows (bounding box from the ORIGINAL geometry, a safe superset). Simplification
tolerance 0.001deg (~110m) is far finer than the 375m-1km hotspot resolution.

Run locally (needs `pip install duckdb`). Output: seed/geocoder/*.sql
"""
import os
import duckdb

DUCKDB = os.environ.get(
    "GEOCODER_DB",
    os.path.join(os.path.dirname(__file__), "..", "..", "de", "data", "geocoder.duckdb"),
)
OUT = os.path.join(os.path.dirname(__file__), "..", "seed", "geocoder")
BOUND_COLS = [
    "id", "province_code", "province_name", "regency_code", "regency_name",
    "district_code", "district_name", "village_code", "village_name", "geom",
]
ROWS_PER_INSERT = 1
ROWS_PER_FILE = 2000


def lit(v):
    if v is None:
        return "''"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def main():
    os.makedirs(OUT, exist_ok=True)
    con = duckdb.connect(DUCKDB, read_only=True)
    con.execute("INSTALL spatial; LOAD spatial;")
    rows = con.execute(
        """
        SELECT row_number() OVER () AS id,
               h.province_code, h.province_name, h.regency_code, h.regency_name,
               h.district_code, h.district_name, h.village_code, h.village_name,
               ST_AsGeoJSON(ST_Simplify(l.geom, 0.001)) AS geom,
               ST_XMin(l.geom) AS min_lng, ST_XMax(l.geom) AS max_lng,
               ST_YMin(l.geom) AS min_lat, ST_YMax(l.geom) AS max_lat
        FROM locations l JOIN hierarchy h ON l.code = h.code
        WHERE l.level = 'village'
        ORDER BY id
        """
    ).fetchall()
    print(f"villages: {len(rows)}")

    with open(os.path.join(OUT, "00_reset.sql"), "w") as f:
        f.write("DELETE FROM geo_boundary;\nDELETE FROM geo_rtree;\n")

    # geo_rtree: small, single file (id, min_lng, max_lng, min_lat, max_lat).
    with open(os.path.join(OUT, "geo_rtree.sql"), "w") as f:
        for i in range(0, len(rows), 400):
            chunk = rows[i : i + 400]
            # columns: id=0, min_lng=10, max_lng=11, min_lat=12, max_lat=13
            values = ",".join(
                f"({r[0]},{r[10]},{r[11]},{r[12]},{r[13]})" for r in chunk
            )
            f.write(
                "INSERT INTO geo_rtree (id, min_lng, max_lng, min_lat, max_lat) VALUES "
                + values + ";\n"
            )

    # geo_boundary: chunked files (geom is large).
    file_idx = 0
    for start in range(0, len(rows), ROWS_PER_FILE):
        block = rows[start : start + ROWS_PER_FILE]
        path = os.path.join(OUT, f"geo_boundary-{file_idx:03d}.sql")
        with open(path, "w") as f:
            for i in range(0, len(block), ROWS_PER_INSERT):
                chunk = block[i : i + ROWS_PER_INSERT]
                values = ",\n".join(
                    "(" + ",".join(lit(r[j]) for j in range(10)) + ")" for r in chunk
                )
                f.write(
                    f"INSERT INTO geo_boundary ({', '.join(BOUND_COLS)}) VALUES\n{values};\n"
                )
        file_idx += 1
    print(f"wrote {file_idx} boundary files + geo_rtree.sql to {os.path.relpath(OUT)}")


if __name__ == "__main__":
    main()
