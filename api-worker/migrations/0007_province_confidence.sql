-- Add a confidence_class dimension to the province rollup so the island/province
-- map and summary can filter by confidence exactly (count + centroid) without
-- falling back to a full fact scan. high_cnt is dropped (derive from the class).
DROP TABLE IF EXISTS agg_daily_province;
CREATE TABLE agg_daily_province (
  date_value       TEXT NOT NULL,
  province_code    TEXT NOT NULL,
  province_name    TEXT NOT NULL DEFAULT '',
  confidence_class TEXT NOT NULL DEFAULT '',
  cnt              INTEGER NOT NULL DEFAULT 0,
  sum_lat          REAL NOT NULL DEFAULT 0,
  sum_lng          REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (date_value, province_code, confidence_class)
);
CREATE INDEX IF NOT EXISTS idx_aggp_date ON agg_daily_province(date_value);
