-- Coordinate -> location_id cache, used only by the ETL worker to avoid
-- re-geocoding coordinates that have already been resolved. Mirrors the
-- ClickHouse geo_coordinate_cache table. location_id references dim_location.id.
CREATE TABLE IF NOT EXISTS geo_coordinate_cache (
  latitude    TEXT NOT NULL,
  longitude   TEXT NOT NULL,
  location_id TEXT NOT NULL,
  PRIMARY KEY (latitude, longitude)
);
