-- Trim fact-table indexes before the bulk import to cut D1 write amplification
-- (each indexed column adds one written row). We keep only the indexes the hot
-- query paths actually need:
--   fact_hotspot: idx_fh_acq_id (keyset pagination + range), idx_fh_loc_period (join)
--   fact_weather: idx_fw_loc_period (join)
-- The dropped indexes only accelerated filters, which are cached and bounded by
-- date-range + limit. They can be recreated later if a workload needs them.
DROP INDEX IF EXISTS idx_fh_location;
DROP INDEX IF EXISTS idx_fh_period;
DROP INDEX IF EXISTS idx_fh_satellite;
DROP INDEX IF EXISTS idx_fh_confidence;
DROP INDEX IF EXISTS idx_fw_acq;
