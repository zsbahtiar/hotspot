-- Tiny hand-made dataset to validate the Worker end-to-end (joins, grouping,
-- island grouping, distributions, periods). Not real data.
DELETE FROM fact_hotspot;
DELETE FROM fact_weather;
DELETE FROM dim_location;
DELETE FROM dim_period;
DELETE FROM dim_satellite;
DELETE FROM dim_confidence;
DELETE FROM dim_weather_condition;

INSERT INTO dim_weather_condition (id, conditions, icon) VALUES
  ('wc1', 'Clear', 'clear-day'),
  ('wc2', 'Partially cloudy', 'partly-cloudy-day');

INSERT INTO dim_confidence (id, confidence_raw, source_instrument, confidence_class, confidence_numeric, confidence_score, description) VALUES
  ('cf_high', 'h', 'MODIS', 'HIGH', 90, 0.9, 'high'),
  ('cf_low',  'l', 'MODIS', 'LOW',  30, 0.3, 'low');

INSERT INTO dim_satellite (id, satellite_name, instrument, product, version, spatial_resolution_m, temporal_resolution_hours, description) VALUES
  ('sat_terra', 'Terra', 'MODIS', 'NRT', '6.1', 1000, 12, 'Terra MODIS'),
  ('sat_npp',   'NPP',   'VIIRS', 'SP',  '2',   375,  12, 'Suomi NPP VIIRS');

INSERT INTO dim_period (id, date_value, year_value, semester_value, quarter_value, month_value, month_name, week_value) VALUES
  ('p_0820', '2026-08-20', 2026, 2, 3, 8, 'August', 34),
  ('p_0821', '2026-08-21', 2026, 2, 3, 8, 'August', 34);

-- Two islands: 12* = SUMATERA, 32* = JAWA
INSERT INTO dim_location (id, province_code, province_name, city_code, city_name, district_code, district_name, subdistrict_code, subdistrict_name) VALUES
  ('loc_su1', '12', 'SUMATERA UTARA', '1275', 'MEDAN',   '1275010', 'MEDAN KOTA',   '1275010001', 'PUSAT PASAR'),
  ('loc_su2', '12', 'SUMATERA UTARA', '1207', 'LANGKAT',  '1207010', 'BAHOROK',     '1207010001', 'TIMBANG JAYA'),
  ('loc_jw1', '32', 'JAWA BARAT',     '3273', 'BANDUNG',  '3273010', 'REGOL',       '3273010001', 'CIGERELENG');

INSERT INTO fact_hotspot (id, satellite_id, confidence_id, period_id, location_id, acquired_at, frp, brightness, latitude, longitude, scan, track, bright_t31, bright_ti4, bright_ti5) VALUES
  ('fh1', 'sat_terra', 'cf_high', 'p_0820', 'loc_su1', '2026-08-20 03:10:00.000', 12.5, 330.1, '3.5897', '98.6720', 1.0, 1.0, 295.0, 0, 0),
  ('fh2', 'sat_npp',   'cf_low',  'p_0820', 'loc_su2', '2026-08-20 03:12:00.000', 5.2,  310.0, '3.5400', '98.1200', 0.5, 0.5, 290.0, 320.0, 300.0),
  ('fh3', 'sat_terra', 'cf_high', 'p_0821', 'loc_jw1', '2026-08-21 02:50:00.000', 22.0, 345.7, '-6.9200', '107.6100', 1.0, 1.0, 300.0, 0, 0),
  ('fh4', 'sat_npp',   'cf_high', 'p_0821', 'loc_su1', '2026-08-21 03:05:00.000', 8.8,  325.0, '3.5901', '98.6700', 0.4, 0.4, 292.0, 318.0, 299.0);

-- One weather row per (location_id, period_id) used by the hotspots above.
INSERT INTO fact_weather (id, period_id, location_id, weather_condition_id, acquired_at, temperature, humidity, wind_speed, wind_degree, visibility, cloud_coverage, latitude, longitude, pressure, uv_index, precipitation, solar_radiation) VALUES
  ('fw1', 'p_0820', 'loc_su1', 'wc1', '2026-08-20 03:00:00.000', 31, 70.0, 3.2, 180.0, 10000, 20, '3.5897', '98.6720', 1010, 8, 0.0, 500.0),
  ('fw2', 'p_0820', 'loc_su2', 'wc2', '2026-08-20 03:00:00.000', 29, 80.0, 2.1, 200.0, 9000,  60, '3.5400', '98.1200', 1011, 6, 0.2, 320.0),
  ('fw3', 'p_0821', 'loc_jw1', 'wc1', '2026-08-21 02:00:00.000', 27, 65.0, 1.5, 150.0, 12000, 10, '-6.9200', '107.6100', 1012, 9, 0.0, 550.0),
  ('fw4', 'p_0821', 'loc_su1', 'wc2', '2026-08-21 03:00:00.000', 30, 72.0, 3.0, 190.0, 9500,  40, '3.5901', '98.6700', 1010, 7, 0.1, 400.0);
