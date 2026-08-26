-- Galaxy schema (fact constellation) ported from ClickHouse to D1/SQLite.
-- Two fact tables (fact_hotspot, fact_weather) share conformed dimensions.
-- Timestamps are stored as ISO8601 TEXT ("YYYY-MM-DD HH:MM:SS.SSS") so that
-- lexicographic ordering matches chronological ordering (needed for keyset paging).

-- ---------- Dimensions ----------

CREATE TABLE IF NOT EXISTS dim_location (
  id                TEXT PRIMARY KEY,
  province_code     TEXT NOT NULL DEFAULT '',
  province_name     TEXT NOT NULL DEFAULT '',
  city_code         TEXT NOT NULL DEFAULT '',
  city_name         TEXT NOT NULL DEFAULT '',
  district_code     TEXT NOT NULL DEFAULT '',
  district_name     TEXT NOT NULL DEFAULT '',
  subdistrict_code  TEXT NOT NULL DEFAULT '',
  subdistrict_name  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_dim_location_province     ON dim_location(province_code);
CREATE INDEX IF NOT EXISTS idx_dim_location_city         ON dim_location(city_code);
CREATE INDEX IF NOT EXISTS idx_dim_location_district     ON dim_location(district_code);
CREATE INDEX IF NOT EXISTS idx_dim_location_subdistrict  ON dim_location(subdistrict_code);

CREATE TABLE IF NOT EXISTS dim_period (
  id             TEXT PRIMARY KEY,
  date_value     TEXT NOT NULL,           -- "YYYY-MM-DD"
  year_value     INTEGER NOT NULL,
  semester_value INTEGER NOT NULL,
  quarter_value  INTEGER NOT NULL,
  month_value    INTEGER NOT NULL,
  month_name     TEXT NOT NULL DEFAULT '',
  week_value     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dim_period_date    ON dim_period(date_value);
CREATE INDEX IF NOT EXISTS idx_dim_period_year    ON dim_period(year_value);
CREATE INDEX IF NOT EXISTS idx_dim_period_ysqmw   ON dim_period(year_value, semester_value, quarter_value, month_value, week_value);

CREATE TABLE IF NOT EXISTS dim_satellite (
  id                        TEXT PRIMARY KEY,
  satellite_name            TEXT NOT NULL DEFAULT '',
  instrument                TEXT NOT NULL DEFAULT '',
  product                   TEXT NOT NULL DEFAULT '',
  version                   TEXT NOT NULL DEFAULT '',
  spatial_resolution_m      INTEGER NOT NULL DEFAULT 0,
  temporal_resolution_hours INTEGER NOT NULL DEFAULT 0,
  description               TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_dim_satellite_name    ON dim_satellite(satellite_name);
CREATE INDEX IF NOT EXISTS idx_dim_satellite_product ON dim_satellite(product);

CREATE TABLE IF NOT EXISTS dim_confidence (
  id                 TEXT PRIMARY KEY,
  confidence_raw     TEXT NOT NULL DEFAULT '',
  source_instrument  TEXT NOT NULL DEFAULT '',
  confidence_class   TEXT NOT NULL DEFAULT '',
  confidence_numeric INTEGER NOT NULL DEFAULT 0,
  confidence_score   REAL NOT NULL DEFAULT 0,
  description        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_dim_confidence_class ON dim_confidence(confidence_class);

CREATE TABLE IF NOT EXISTS dim_weather_condition (
  id         TEXT PRIMARY KEY,
  conditions TEXT NOT NULL DEFAULT '',
  icon       TEXT NOT NULL DEFAULT ''
);

-- ---------- Facts ----------

CREATE TABLE IF NOT EXISTS fact_hotspot (
  id            TEXT PRIMARY KEY,
  satellite_id  TEXT NOT NULL,
  confidence_id TEXT NOT NULL,
  period_id     TEXT NOT NULL,
  location_id   TEXT NOT NULL,
  acquired_at   TEXT NOT NULL,           -- ISO8601 UTC
  frp           REAL NOT NULL DEFAULT 0,
  brightness    REAL NOT NULL DEFAULT 0,
  latitude      TEXT NOT NULL DEFAULT '',
  longitude     TEXT NOT NULL DEFAULT '',
  scan          REAL NOT NULL DEFAULT 0,
  track         REAL NOT NULL DEFAULT 0,
  bright_t31    REAL NOT NULL DEFAULT 0,
  bright_ti4    REAL NOT NULL DEFAULT 0,
  bright_ti5    REAL NOT NULL DEFAULT 0
);
-- Keyset pagination: ORDER BY acquired_at DESC, id DESC over a time range.
CREATE INDEX IF NOT EXISTS idx_fh_acq_id      ON fact_hotspot(acquired_at, id);
CREATE INDEX IF NOT EXISTS idx_fh_location    ON fact_hotspot(location_id);
CREATE INDEX IF NOT EXISTS idx_fh_period      ON fact_hotspot(period_id);
CREATE INDEX IF NOT EXISTS idx_fh_satellite   ON fact_hotspot(satellite_id);
CREATE INDEX IF NOT EXISTS idx_fh_confidence  ON fact_hotspot(confidence_id);
-- Composite join key back to fact_weather.
CREATE INDEX IF NOT EXISTS idx_fh_loc_period  ON fact_hotspot(location_id, period_id);

CREATE TABLE IF NOT EXISTS fact_weather (
  id                   TEXT PRIMARY KEY,
  period_id            TEXT NOT NULL,
  location_id          TEXT NOT NULL,
  weather_condition_id TEXT NOT NULL,
  acquired_at          TEXT NOT NULL,
  temperature          INTEGER NOT NULL DEFAULT 0,
  humidity             REAL NOT NULL DEFAULT 0,
  wind_speed           REAL NOT NULL DEFAULT 0,
  wind_degree          REAL NOT NULL DEFAULT 0,
  visibility           INTEGER NOT NULL DEFAULT 0,
  cloud_coverage       INTEGER NOT NULL DEFAULT 0,
  latitude             TEXT NOT NULL DEFAULT '',
  longitude            TEXT NOT NULL DEFAULT '',
  pressure             INTEGER NOT NULL DEFAULT 0,
  uv_index             INTEGER NOT NULL DEFAULT 0,
  precipitation        REAL NOT NULL DEFAULT 0,
  solar_radiation      REAL NOT NULL DEFAULT 0
);
-- fact_hotspot INNER JOINs fact_weather ON (location_id, period_id) within a time range.
CREATE INDEX IF NOT EXISTS idx_fw_loc_period ON fact_weather(location_id, period_id);
CREATE INDEX IF NOT EXISTS idx_fw_acq        ON fact_weather(acquired_at);
