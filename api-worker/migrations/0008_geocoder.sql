-- Offline reverse geocoder ported from the DuckDB spatial database.
-- geo_boundary holds each village's administrative hierarchy + simplified polygon
-- (GeoJSON). geo_rtree is an R*Tree bounding-box index (D1/SQLite supports rtree)
-- used to find candidate villages for a point; the Worker then runs an exact
-- point-in-polygon test on the candidates. Replaces the coordinate cache + BMKG.
CREATE TABLE IF NOT EXISTS geo_boundary (
  id            INTEGER PRIMARY KEY,
  province_code TEXT NOT NULL DEFAULT '',
  province_name TEXT NOT NULL DEFAULT '',
  regency_code  TEXT NOT NULL DEFAULT '',
  regency_name  TEXT NOT NULL DEFAULT '',
  district_code TEXT NOT NULL DEFAULT '',
  district_name TEXT NOT NULL DEFAULT '',
  village_code  TEXT NOT NULL DEFAULT '',
  village_name  TEXT NOT NULL DEFAULT '',
  geom          TEXT NOT NULL              -- GeoJSON geometry (Polygon/MultiPolygon)
);

CREATE VIRTUAL TABLE IF NOT EXISTS geo_rtree USING rtree(
  id,
  min_lng, max_lng,
  min_lat, max_lat
);
