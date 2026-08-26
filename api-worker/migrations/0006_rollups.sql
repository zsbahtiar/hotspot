-- Daily-grain rollups so the dashboard summary reads ~thousands of aggregated
-- rows instead of scanning millions of fact rows (D1 is row-based, not columnar).
-- date_value is the UTC date of acquired_at ("YYYY-MM-DD"). sum_lat/sum_lng let
-- the locations view recover an average coordinate (sum/cnt).

CREATE TABLE IF NOT EXISTS agg_daily_province (
  date_value    TEXT NOT NULL,
  province_code TEXT NOT NULL,
  province_name TEXT NOT NULL DEFAULT '',
  cnt           INTEGER NOT NULL DEFAULT 0,
  high_cnt      INTEGER NOT NULL DEFAULT 0,
  sum_lat       REAL NOT NULL DEFAULT 0,
  sum_lng       REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (date_value, province_code)
);
CREATE INDEX IF NOT EXISTS idx_agg_prov_date ON agg_daily_province(date_value);

CREATE TABLE IF NOT EXISTS agg_daily_city (
  date_value    TEXT NOT NULL,
  province_code TEXT NOT NULL DEFAULT '',
  city_code     TEXT NOT NULL,
  city_name     TEXT NOT NULL DEFAULT '',
  cnt           INTEGER NOT NULL DEFAULT 0,
  sum_lat       REAL NOT NULL DEFAULT 0,
  sum_lng       REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (date_value, city_code)
);
CREATE INDEX IF NOT EXISTS idx_agg_city_date ON agg_daily_city(date_value);

CREATE TABLE IF NOT EXISTS agg_daily_satellite (
  date_value     TEXT NOT NULL,
  satellite_name TEXT NOT NULL,
  cnt            INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date_value, satellite_name)
);
CREATE INDEX IF NOT EXISTS idx_agg_sat_date ON agg_daily_satellite(date_value);

CREATE TABLE IF NOT EXISTS agg_daily_confidence (
  date_value       TEXT NOT NULL,
  confidence_class TEXT NOT NULL,
  cnt              INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date_value, confidence_class)
);
CREATE INDEX IF NOT EXISTS idx_agg_conf_date ON agg_daily_confidence(date_value);
