CREATE DATABASE IF NOT EXISTS hotspot;

USE hotspot;
CREATE TABLE hotspot.staging_weather
(
    `batch_id` String,
    `ingested_at` DateTime64(3, 'UTC'),
    `latitude` String,
    `longitude` String,
    `datetime` DateTime64(3, 'UTC'),
    `temperature` Int16 DEFAULT 0,
    `feels_like` Float32 DEFAULT 0,
    `humidity` Float32 DEFAULT 0,
    `precipitation` Float32 DEFAULT 0,
    `precip_prob` UInt8 DEFAULT 0,
    `wind_speed` Float32 DEFAULT 0,
    `wind_degree` Float32 DEFAULT 0,
    `wind_gust` Float32 DEFAULT 0,
    `pressure` UInt16 DEFAULT 0,
    `visibility` UInt16 DEFAULT 0,
    `cloud_coverage` UInt8 DEFAULT 0,
    `solar_radiation` Float32 DEFAULT 0,
    `solar_energy` Float32 DEFAULT 0,
    `uv_index` UInt8 DEFAULT 0,
    `severe_risk` UInt8 DEFAULT 0,
    `conditions` String DEFAULT '',
    `icon` String DEFAULT '',
    `weather_id` String MATERIALIZED concat(toString(latitude), ':', toString(longitude), ':', toString(datetime))
)
ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY toYYYYMM(datetime)
ORDER BY (latitude, longitude, datetime)
SETTINGS index_granularity = 8192;

CREATE TABLE hotspot.staging_hotspot
(
    `batch_id` String,
    `ingested_at` DateTime64(3, 'UTC'),
    `latitude` String,
    `longitude` String,
    `acq_date` Date,
    `acq_time` String,
    `satellite` String,
    `instrument` String,
    `confidence` String,
    `version` String,
    `frp` Float32 DEFAULT 0,
    `daynight` FixedString(1),
    `brightness` Float32 DEFAULT 0,
    `bright_t31` Float32 DEFAULT 0,
    `scan` Float32 DEFAULT 0,
    `track` Float32 DEFAULT 0,
    `bright_ti4` Float32 DEFAULT 0,
    `bright_ti5` Float32 DEFAULT 0,
    `hotspot_id` String MATERIALIZED concat(toString(latitude), ':', toString(longitude), ':', toString(acq_date), ':', acq_time, ':', satellite, ':', instrument, ':', version)
)
ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY toYYYYMM(acq_date)
ORDER BY (latitude, longitude, acq_date, acq_time, satellite, instrument, version)
SETTINGS index_granularity = 8192;

CREATE TABLE hotspot.dim_confidence
(
    `id` String,
    `confidence_raw` String,
    `source_instrument` String,
    `confidence_class` String,
    `confidence_numeric` UInt8,
    `confidence_score` Float32,
    `description` String
)
ENGINE = MergeTree
ORDER BY (source_instrument, confidence_raw)
SETTINGS index_granularity = 8192;

CREATE TABLE hotspot.dim_location
(
    `id` String,
    `latitude` String,
    `longitude` String,
    `province_code` String,
    `province_name` String,
    `city_code` String,
    `city_name` String,
    `district_code` String,
    `district_name` String,
    `subdistrict_code` String,
    `subdistrict_name` String
)
ENGINE = ReplacingMergeTree
PRIMARY KEY (latitude, longitude)
ORDER BY (latitude, longitude)
SETTINGS index_granularity = 8192;

CREATE TABLE hotspot.dim_period
(
    `id` String,
    `date_value` Date,
    `year_value` UInt16,
    `semester_value` UInt8,
    `quarter_value` UInt8,
    `month_value` UInt8,
    `month_name` String,
    `week_value` UInt8
)
ENGINE = ReplacingMergeTree
PRIMARY KEY tuple(id)
ORDER BY id
SETTINGS index_granularity = 8192;

CREATE TABLE hotspot.dim_satellite
(
    `id` String,
    `satellite_name` String,
    `instrument` String,
    `version` String,
    `spatial_resolution_m` Int32,
    `temporal_resolution_hours` Int32,
    `description` String
)
ENGINE = ReplacingMergeTree
PRIMARY KEY tuple(id)
ORDER BY id
SETTINGS index_granularity = 8192;

CREATE TABLE hotspot.dim_weather_condition
(
    `id` String,
    `conditions` String,
    `icon` String
)
ENGINE = ReplacingMergeTree
PRIMARY KEY tuple(id)
ORDER BY id
SETTINGS index_granularity = 8192;

CREATE TABLE hotspot.fact_hotspot
(
    `id` String,
    `satellite_id` String,
    `confidence_id` String,
    `period_id` String,
    `location_id` String,
    `acquired_at` DateTime64(3, 'UTC'),
    `frp` Float32 DEFAULT 0,
    `brightness` Float32 DEFAULT 0,
    `latitude` String,
    `longitude` String,
    `scan` Float32 DEFAULT 0,
    `track` Float32 DEFAULT 0,
    `bright_t31` Float32 DEFAULT 0,
    `bright_ti4` Float32 DEFAULT 0,
    `bright_ti5` Float32 DEFAULT 0
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(acquired_at)
ORDER BY (period_id, location_id, satellite_id)
SETTINGS index_granularity = 8192;

CREATE TABLE hotspot.fact_weather
(
    `id` String,
    `period_id` String,
    `location_id` String,
    `weather_condition_id` String,
    `acquired_at` DateTime64(3, 'UTC'),
    `temperature` Int16 DEFAULT 0,
    `humidity` Float32 DEFAULT 0,
    `wind_speed` Float32 DEFAULT 0,
    `wind_degree` Float32 DEFAULT 0,
    `visibility` UInt16 DEFAULT 0,
    `cloud_coverage` UInt8 DEFAULT 0,
    `latitude` String,
    `longitude` String,
    `pressure` UInt16 DEFAULT 0,
    `uv_index` UInt8 DEFAULT 0,
    `precipitation` Float32 DEFAULT 0,
    `solar_radiation` Float32 DEFAULT 0
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(acquired_at)
ORDER BY (period_id, location_id, weather_condition_id)
SETTINGS index_granularity = 8192;