-- The weather backfill no longer uses an explicit queue table: the pending set
-- is derived from the data (hotspots whose location+period has no fact_weather).
DROP INDEX IF EXISTS idx_wq_status;
DROP TABLE IF EXISTS weather_queue;
