-- Async weather backfill queue. The ingest path enqueues one row per unique
-- (coordinate, date) that still needs weather; a separate throttled cron drains
-- it within the VisualCrossing free budget (1000 records/day) and writes
-- fact_weather. Dedup is by the (lat, lng, date) primary key.
CREATE TABLE IF NOT EXISTS weather_queue (
  latitude    TEXT NOT NULL,
  longitude   TEXT NOT NULL,
  date_value  TEXT NOT NULL,            -- YYYY-MM-DD
  location_id TEXT NOT NULL,
  period_id   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | done | failed
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (latitude, longitude, date_value)
);
CREATE INDEX IF NOT EXISTS idx_wq_status ON weather_queue(status, created_at);
