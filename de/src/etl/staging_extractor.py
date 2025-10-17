import polars as pl
from datetime import datetime
import pytz
import asyncio
from typing import Dict, Optional
from ulid import ULID
from src.etl.clients import NASAFIRMSClient, LocationService, WeatherService
from src.etl.loader import ClickHouseLoader
from src.utils.logging import get_logger
from src.config import settings

logger = get_logger(__name__)


class StagingExtractor:
    def __init__(self):
        self.batch_id = str(ULID())
        self.ingested_at = datetime.now(pytz.UTC)

    async def extract_to_staging(self, date_str: str) -> Dict[str, pl.DataFrame]:
        logger.info(
            f"Starting staging extraction for {date_str} with batch_id: {self.batch_id}"
        )

        query_date_str = date_str
        logger.info(f"Querying NASA FIRMS for {query_date_str} date")

        staging_data = {}

        hotspot_df = await self._extract_raw_hotspot_data(date_str, query_date_str)
        if hotspot_df is not None and not hotspot_df.is_empty():
            location_df, weather_df = await asyncio.gather(
                self._extract_and_load_location_data(hotspot_df),
                self._extract_raw_weather_data(hotspot_df),
                return_exceptions=True,
            )

            if isinstance(location_df, Exception):
                logger.error(f"Location extraction failed: {location_df}")
                location_df = None

            if isinstance(weather_df, Exception):
                logger.error(f"Weather extraction failed: {weather_df}")
                weather_df = None

            if location_df is not None and not location_df.is_empty():
                logger.info(
                    f"Loaded {len(location_df)} valid location records to dim_location"
                )

                original_count = len(hotspot_df)
                hotspot_df = hotspot_df.join(
                    location_df.select(["latitude", "longitude"]),
                    on=["latitude", "longitude"],
                    how="inner",
                )
                filtered_count = len(hotspot_df)
                rejected_count = original_count - filtered_count

                if rejected_count > 0:
                    logger.warning(
                        f"Filtered out {rejected_count} hotspots with invalid/non-Indonesia coordinates"
                    )

                if hotspot_df.is_empty():
                    logger.warning("No hotspots with valid Indonesia coordinates")
                    return staging_data

                staging_data["staging_hotspot"] = self._prepare_staging_hotspot(
                    hotspot_df
                )
                logger.info(
                    f"Prepared {len(staging_data['staging_hotspot'])} records for staging_hotspot"
                )

                if weather_df is not None and not weather_df.is_empty():
                    original_weather_count = len(weather_df)
                    weather_df = weather_df.join(
                        location_df.select(["latitude", "longitude"]),
                        on=["latitude", "longitude"],
                        how="inner",
                    )
                    filtered_weather_count = len(weather_df)
                    rejected_weather_count = (
                        original_weather_count - filtered_weather_count
                    )

                    if rejected_weather_count > 0:
                        logger.warning(
                            f"Filtered out {rejected_weather_count} weather records with invalid/non-Indonesia coordinates"
                        )

                    if not weather_df.is_empty():
                        weather_df = self._deduplicate_weather_data(weather_df)
                        staging_data["staging_weather"] = self._prepare_staging_weather(
                            weather_df
                        )
                        logger.info(
                            f"Prepared {len(staging_data['staging_weather'])} records for staging_weather"
                        )
            else:
                logger.warning(
                    "No valid location data retrieved, skipping staging preparation"
                )

        return staging_data

    async def _extract_raw_hotspot_data(
        self, date_str: str, query_date_str: str = None
    ) -> Optional[pl.DataFrame]:
        if query_date_str is None:
            query_date_str = date_str

        client = NASAFIRMSClient(api_key=settings.nasa_firms_api_key)

        try:
            sources = [
                "MODIS_NRT",
                "MODIS_SP",
                "VIIRS_NOAA20_NRT",
                "VIIRS_NOAA20_SP",
                "VIIRS_NOAA21_NRT",
                "VIIRS_SNPP_NRT",
                "VIIRS_SNPP_SP",
            ]

            all_dfs = []
            for source in sources:
                try:
                    df = await client.get_hotspots(
                        country="IDN", source=source, day_range=1
                    )
                    if not df.is_empty():
                        df = df.with_columns(pl.lit(source).alias("source_api"))

                        all_dfs.append(df)
                        logger.info(f"Extracted {len(df)} records from {source}")
                except Exception as e:
                    logger.warning(f"Failed to fetch {source}: {e}")
                    continue

            if all_dfs:
                normalized_dfs = []

                for df in all_dfs:
                    normalized_df = df.select(
                        [pl.col(col).cast(pl.Utf8).alias(col) for col in df.columns]
                    )
                    normalized_dfs.append(normalized_df)

                combined_df = pl.concat(normalized_dfs, how="diagonal")
                logger.info(
                    f"Total hotspot records before filtering: {len(combined_df)}"
                )

                if "acq_date" in combined_df.columns:
                    combined_df = combined_df.filter(
                        pl.col("acq_date") == query_date_str
                    )
                    logger.info(
                        f"Filtered to {len(combined_df)} records for date {query_date_str}"
                    )

                dedup_columns = [
                    "latitude",
                    "longitude",
                    "acq_date",
                    "acq_time",
                    "satellite",
                    "instrument",
                ]
                available_dedup_cols = [
                    col for col in dedup_columns if col in combined_df.columns
                ]

                if len(available_dedup_cols) >= 4:
                    combined_df = combined_df.unique(
                        subset=available_dedup_cols, keep="first"
                    )
                    logger.info(
                        f"Total hotspot records after deduplication: {len(combined_df)}"
                    )
                else:
                    logger.warning(
                        f"Insufficient columns for deduplication: {available_dedup_cols}"
                    )

                return combined_df
            else:
                logger.warning(f"No hotspot data found for {date_str}")
                return None

        except Exception as e:
            logger.error(f"Error extracting hotspot data: {e}")
            return None

    async def _extract_and_load_location_data(
        self, hotspot_df: pl.DataFrame
    ) -> Optional[pl.DataFrame]:
        location_service = LocationService()
        loader = ClickHouseLoader()

        try:
            unique_coords = hotspot_df.select(["latitude", "longitude"]).unique()
            coord_records = unique_coords.to_dicts()

            logger.info(f"Geocoding {len(coord_records)} unique coordinates")

            location_data = await location_service.get_location_bulk(coord_records)

            if location_data:
                location_df = pl.DataFrame(location_data)

                location_df = location_df.with_columns(
                    [pl.lit(None).cast(pl.Utf8).alias("id")]
                )

                location_ids = [str(ULID()) for _ in range(len(location_df))]
                location_df = location_df.with_columns(
                    [pl.Series("id", location_ids, dtype=pl.Utf8)]
                ).select(
                    [
                        "id",
                        "latitude",
                        "longitude",
                        "province_code",
                        "province_name",
                        "city_code",
                        "city_name",
                        "district_code",
                        "district_name",
                        "subdistrict_code",
                        "subdistrict_name",
                    ]
                )

                await loader.load_dimension_composite_key(
                    "dim_location", location_df, ["latitude", "longitude"]
                )
                logger.info(
                    f"Loaded {len(location_df)} location records to dim_location"
                )
                return location_df
            else:
                logger.warning("No location data retrieved")
                return None

        except Exception as e:
            logger.error(f"Error extracting and loading location data: {e}")
            return None

    async def _extract_raw_weather_data(
        self, hotspot_df: pl.DataFrame
    ) -> Optional[pl.DataFrame]:
        weather_service = WeatherService()

        try:
            unique_coords = hotspot_df.select(
                ["latitude", "longitude", "acq_date", "acq_time"]
            ).unique()
            coord_records = unique_coords.to_dicts()

            logger.info(
                f"Requesting weather data for {len(coord_records)} unique coordinates"
            )

            weather_data = await weather_service.get_weather_bulk(coord_records)

            if weather_data:
                weather_df = pl.DataFrame(weather_data)

                if "temperature" in weather_df.columns:
                    weather_df = weather_df.with_columns(
                        pl.col("temperature").cast(pl.Int16, strict=False)
                    )

                for col in ["pressure", "visibility"]:
                    if col in weather_df.columns:
                        weather_df = weather_df.with_columns(
                            pl.col(col).cast(pl.UInt16, strict=False)
                        )

                for col in ["cloud_coverage", "precip_prob", "uv_index", "severe_risk"]:
                    if col in weather_df.columns:
                        weather_df = weather_df.with_columns(
                            pl.col(col).cast(pl.UInt8, strict=False)
                        )

                for col in [
                    "feels_like",
                    "humidity",
                    "precipitation",
                    "wind_speed",
                    "wind_degree",
                    "wind_gust",
                    "solar_radiation",
                    "solar_energy",
                ]:
                    if col in weather_df.columns:
                        weather_df = weather_df.with_columns(
                            pl.col(col).cast(pl.Float32, strict=False)
                        )

                logger.info(f"Extracted weather data for {len(weather_data)} locations")
                return weather_df
            else:
                logger.warning("No weather data retrieved")
                return None

        except Exception as e:
            logger.error(f"Error extracting weather data: {e}")
            return None

    def _deduplicate_weather_data(self, df: pl.DataFrame) -> pl.DataFrame:
        logger.info(f"Weather records before deduplication: {len(df)}")

        dedup_columns = ["latitude", "longitude"]
        if "datetime" in df.columns:
            dedup_columns.append("datetime")

        available_dedup_cols = [col for col in dedup_columns if col in df.columns]

        if len(available_dedup_cols) >= 2:
            df = df.unique(subset=available_dedup_cols, keep="first")
            logger.info(f"Weather records after deduplication: {len(df)}")
        else:
            logger.warning(
                f"Insufficient columns for weather deduplication: {available_dedup_cols}"
            )

        return df

    def _prepare_staging_hotspot(self, df: pl.DataFrame) -> pl.DataFrame:
        staging_df = df.with_columns(
            [
                pl.lit(self.batch_id).alias("batch_id"),
                pl.lit(self.ingested_at.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]).alias(
                    "ingested_at"
                ),
                pl.col("latitude").cast(pl.Utf8),
                pl.col("longitude").cast(pl.Utf8),
            ]
        )

        column_mapping = {
            "country_id": "country_id",
            "latitude": "latitude",
            "longitude": "longitude",
            "acq_date": "acq_date",
            "acq_time": "acq_time",
            "satellite": "satellite",
            "instrument": "instrument",
            "confidence": "confidence",
            "version": "version",
            "frp": "frp",
            "daynight": "daynight",
            "brightness": "brightness",
            "bright_t31": "bright_t31",
            "scan": "scan",
            "track": "track",
            "bright_ti4": "bright_ti4",
            "bright_ti5": "bright_ti5",
        }

        available_columns = ["batch_id", "ingested_at"]
        for original_col, staging_col in column_mapping.items():
            if original_col in staging_df.columns:
                available_columns.append(original_col)

        staging_df = staging_df.select(available_columns)

        if "brightness" not in staging_df.columns:
            staging_df = staging_df.with_columns(pl.lit(None).alias("brightness"))
        if "bright_t31" not in staging_df.columns:
            staging_df = staging_df.with_columns(pl.lit(None).alias("bright_t31"))
        if "scan" not in staging_df.columns:
            staging_df = staging_df.with_columns(pl.lit(None).alias("scan"))
        if "track" not in staging_df.columns:
            staging_df = staging_df.with_columns(pl.lit(None).alias("track"))
        if "bright_ti4" not in staging_df.columns:
            staging_df = staging_df.with_columns(pl.lit(None).alias("bright_ti4"))
        if "bright_ti5" not in staging_df.columns:
            staging_df = staging_df.with_columns(pl.lit(None).alias("bright_ti5"))

        return staging_df

    def _prepare_staging_weather(self, df: pl.DataFrame) -> pl.DataFrame:
        logger.info(f"Weather DataFrame columns: {df.columns}")
        if len(df) > 0:
            logger.info(f"Sample weather record: {df.head(1).to_dicts()[0]}")

        staging_df = df.with_columns(
            [
                pl.lit(self.batch_id).alias("batch_id"),
                pl.lit(self.ingested_at.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]).alias(
                    "ingested_at"
                ),
                pl.col("latitude").cast(pl.Utf8),
                pl.col("longitude").cast(pl.Utf8),
            ]
        )

        staging_columns = [
            "batch_id",
            "ingested_at",
            "latitude",
            "longitude",
            "datetime",
            "temperature",
            "feels_like",
            "humidity",
            "precipitation",
            "precip_prob",
            "wind_speed",
            "wind_degree",
            "wind_gust",
            "pressure",
            "visibility",
            "cloud_coverage",
            "solar_radiation",
            "solar_energy",
            "uv_index",
            "severe_risk",
            "conditions",
            "icon",
        ]

        available_staging_columns = [
            col for col in staging_columns if col in staging_df.columns
        ]
        staging_df = staging_df.select(available_staging_columns)

        logger.info(f"Prepared staging_weather with columns: {staging_df.columns}")
        return staging_df

    def get_batch_metadata(self) -> Dict[str, str]:
        return {
            "batch_id": self.batch_id,
            "ingested_at": self.ingested_at.isoformat(),
            "extraction_type": "staging_only",
            "status": "extracted",
        }
