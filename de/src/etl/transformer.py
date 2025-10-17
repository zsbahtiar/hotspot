import polars as pl
from typing import Dict
import pytz
import io
from ulid import ULID
from src.utils.logging import get_logger
from src.etl.loader import ClickHouseLoader

logger = get_logger(__name__)


class IDMappings:
    def __init__(self):
        self.location_map = {}
        self.confidence_map = {}
        self.time_map = {}
        self.weather_condition_map = {}
        self.loader = None

    async def load_existing_locations(self):
        if not self.loader:
            return

        try:
            query = """
            SELECT subdistrict_code, id
            FROM dim_location
            WHERE subdistrict_code != ''
            """
            result = await self.loader.execute_query(query)

            if result.strip():
                for line in result.strip().split("\n"):
                    parts = line.split("\t")
                    if len(parts) >= 2:
                        subdistrict_code, location_id = (
                            parts[0].strip(),
                            parts[1].strip(),
                        )
                        self.location_map[subdistrict_code] = location_id

            logger.info(f"Loaded {len(self.location_map)} existing locations for reuse")
        except Exception as e:
            logger.warning(f"Could not load existing locations: {e}")

    async def load_existing_weather_conditions(self):
        if not self.loader:
            return

        try:
            query = """
            SELECT conditions, id
            FROM dim_weather_condition
            WHERE conditions != ''
            """
            result = await self.loader.execute_query(query)

            if result.strip():
                for line in result.strip().split("\n"):
                    parts = line.split("\t")
                    if len(parts) >= 2:
                        conditions, weather_id = parts[0].strip(), parts[1].strip()
                        self.weather_condition_map[conditions] = weather_id

            logger.info(
                f"Loaded {len(self.weather_condition_map)} existing weather conditions for reuse"
            )
        except Exception as e:
            logger.warning(f"Could not load existing weather conditions: {e}")

    async def load_existing_confidence(self):
        if not self.loader:
            return

        try:
            query = """
            SELECT confidence_raw, source_instrument, id
            FROM dim_confidence
            """
            result = await self.loader.execute_query(query)

            if result.strip():
                for line in result.strip().split("\n"):
                    parts = line.split("\t")
                    if len(parts) >= 3:
                        confidence_raw = parts[0].strip()
                        source_instrument = parts[1].strip()
                        confidence_id = parts[2].strip()
                        key = f"{confidence_raw}_{source_instrument}"
                        self.confidence_map[key] = confidence_id

            logger.info(
                f"Loaded {len(self.confidence_map)} existing confidence levels for reuse"
            )
        except Exception as e:
            logger.warning(f"Could not load existing confidence: {e}")

    async def get_period_id_for_date(self, date_value: str) -> str:
        if not self.loader:
            if date_value not in self.time_map:
                self.time_map[date_value] = str(ULID())
            return self.time_map[date_value]

        try:
            query = f"""
            SELECT id
            FROM dim_period
            WHERE date_value = '{date_value}'
            LIMIT 1
            """
            result = await self.loader.execute_query(query)

            if result.strip():
                period_id = result.strip()
                self.time_map[date_value] = period_id
                return period_id
            else:
                if date_value not in self.time_map:
                    self.time_map[date_value] = str(ULID())
                return self.time_map[date_value]

        except Exception as e:
            logger.warning(f"Could not check existing period for {date_value}: {e}")
            if date_value not in self.time_map:
                self.time_map[date_value] = str(ULID())
            return self.time_map[date_value]

    def get_location_id(self, subdistrict_code: str) -> str:
        key = subdistrict_code
        if key not in self.location_map:
            self.location_map[key] = str(ULID())
        return self.location_map[key]

    def get_confidence_id(self, confidence: str, instrument: str) -> str:
        key = f"{confidence}_{instrument}"
        if key not in self.confidence_map:
            self.confidence_map[key] = str(ULID())
        return self.confidence_map[key]

    def get_time_id(self, timestamp_str: str) -> str:
        key = timestamp_str
        if key not in self.time_map:
            self.time_map[key] = str(ULID())
        return self.time_map[key]

    def get_weather_condition_id(self, conditions: str) -> str:
        key = conditions
        if key not in self.weather_condition_map:
            self.weather_condition_map[key] = str(ULID())
        return self.weather_condition_map[key]


class HotspotTransformer:
    def __init__(self):
        self.wib_tz = pytz.timezone("Asia/Jakarta")
        self.loader = None
        self.id_mappings = IDMappings()

    async def transform_staging_to_hotspot(
        self, batch_id: str = None
    ) -> Dict[str, pl.DataFrame]:
        if not self.loader:
            self.loader = ClickHouseLoader()

        self.id_mappings.loader = self.loader
        await self.id_mappings.load_existing_locations()
        await self.id_mappings.load_existing_weather_conditions()
        await self.id_mappings.load_existing_confidence()

        logger.info(f"Starting hotspot transformation for batch: {batch_id}")

        staging_hotspot = await self._read_staging_hotspot(batch_id)
        staging_weather = await self._read_staging_weather(batch_id)

        if staging_hotspot.is_empty():
            logger.warning("No staging hotspot data found")
            return {}

        logger.info(f"Processing {len(staging_hotspot)} staging hotspot records")
        logger.info(f"Processing {len(staging_weather)} staging weather records")

        dimensional_data = {}

        dimensional_data["dim_period"] = await self._create_dim_period(staging_hotspot)

        dimensional_data["dim_satellite"] = self._create_dim_satellite(staging_hotspot)

        dimensional_data["dim_confidence"] = self._create_dim_confidence(
            staging_hotspot
        )

        dimensional_data["dim_weather_condition"] = self._create_dim_weather_condition(
            staging_weather
        )

        dimensional_data["fact_hotspot"] = await self._create_fact_hotspot(
            staging_hotspot, staging_weather
        )

        dimensional_data["fact_weather"] = await self._create_fact_weather(
            staging_weather
        )

        logger.info(
            f"Hotspot transformation completed. Created {len(dimensional_data)} tables"
        )
        return dimensional_data

    async def _read_staging_hotspot(self, batch_id: str = None) -> pl.DataFrame:
        if batch_id:
            query = f"SELECT * FROM staging_hotspot WHERE batch_id = '{batch_id}'"
        else:
            query = """
            SELECT * FROM staging_hotspot
            WHERE batch_id = (
                SELECT batch_id FROM staging_hotspot
                ORDER BY ingested_at DESC LIMIT 1
            )
            """

        try:
            result = await self.loader.execute_query(query + " FORMAT CSVWithNames")
            if result.strip():
                lines = result.strip().split("\n")
                if len(lines) > 1:
                    csv_data = io.StringIO(result)
                    return pl.read_csv(
                        csv_data,
                        null_values=["\\N"],
                        schema_overrides={
                            "confidence": pl.Utf8,
                            "latitude": pl.Utf8,
                            "longitude": pl.Utf8,
                            "frp": pl.Float32,
                            "brightness": pl.Float32,
                            "bright_t31": pl.Float32,
                            "scan": pl.Float32,
                            "track": pl.Float32,
                            "bright_ti4": pl.Float32,
                            "bright_ti5": pl.Float32,
                        },
                    )
            return pl.DataFrame()
        except Exception as e:
            logger.error(f"Error reading staging hotspot: {e}")
            return pl.DataFrame()

    async def _read_staging_weather(self, batch_id: str = None) -> pl.DataFrame:
        if batch_id:
            query = f"SELECT * FROM staging_weather WHERE batch_id = '{batch_id}'"
        else:
            query = """
            SELECT * FROM staging_weather
            WHERE batch_id = (
                SELECT batch_id FROM staging_weather
                ORDER BY ingested_at DESC LIMIT 1
            )
            """

        try:
            result = await self.loader.execute_query(query + " FORMAT CSVWithNames")
            if result.strip():
                lines = result.strip().split("\n")
                if len(lines) > 1:
                    csv_data = io.StringIO(result)
                    return pl.read_csv(
                        csv_data,
                        null_values=["\\N"],
                        schema_overrides={
                            "latitude": pl.Utf8,
                            "longitude": pl.Utf8,
                            "temperature": pl.Int16,
                            "feels_like": pl.Float32,
                            "humidity": pl.Float32,
                            "precipitation": pl.Float32,
                            "precip_prob": pl.UInt8,
                            "wind_speed": pl.Float32,
                            "wind_degree": pl.Float32,
                            "wind_gust": pl.Float32,
                            "pressure": pl.UInt16,
                            "visibility": pl.UInt16,
                            "cloud_coverage": pl.UInt8,
                            "solar_radiation": pl.Float32,
                            "solar_energy": pl.Float32,
                            "uv_index": pl.UInt8,
                            "severe_risk": pl.UInt8,
                        },
                    )
            return pl.DataFrame()
        except Exception as e:
            logger.error(f"Error reading staging weather: {e}")
            return pl.DataFrame()

    async def _create_dim_period(self, staging_hotspot: pl.DataFrame) -> pl.DataFrame:
        if staging_hotspot.is_empty():
            return pl.DataFrame()

        date_df = staging_hotspot.select(
            [pl.col("acq_date").cast(pl.Date).alias("date_value")]
        ).unique()

        period_ids = []
        for date_row in date_df.iter_rows(named=True):
            date_str = str(date_row["date_value"])
            period_id = await self.id_mappings.get_period_id_for_date(date_str)
            period_ids.append(period_id)

        dim_period = date_df.with_columns(
            [
                pl.Series("id", period_ids, dtype=pl.Utf8),
                pl.col("date_value").dt.year().alias("year_value"),
                pl.when(pl.col("date_value").dt.month() <= 6)
                .then(pl.lit(1))
                .otherwise(pl.lit(2))
                .alias("semester_value"),
                pl.col("date_value").dt.quarter().alias("quarter_value"),
                pl.col("date_value").dt.month().alias("month_value"),
                pl.col("date_value").dt.strftime("%B").alias("month_name"),
                pl.col("date_value").dt.week().alias("week_value"),
            ]
        ).select(
            [
                "id",
                "date_value",
                "year_value",
                "semester_value",
                "quarter_value",
                "month_value",
                "month_name",
                "week_value",
            ]
        )

        return dim_period

    def _create_dim_satellite(self, staging_hotspot: pl.DataFrame) -> pl.DataFrame:
        if staging_hotspot.is_empty():
            return pl.DataFrame()

        satellite_df = staging_hotspot.select(
            ["satellite", "instrument", "version"]
        ).unique()

        dim_satellite = satellite_df.with_columns(
            [
                (pl.col("satellite") + "_" + pl.col("instrument")).alias("id"),
                pl.col("satellite").alias("satellite_name"),
                pl.when(pl.col("instrument") == "MODIS")
                .then(pl.lit(1000))
                .when(pl.col("instrument") == "VIIRS")
                .then(pl.lit(375))
                .otherwise(pl.lit(1000))
                .alias("spatial_resolution_m"),
                pl.when(pl.col("instrument") == "MODIS")
                .then(pl.lit(12))
                .when(pl.col("instrument") == "VIIRS")
                .then(pl.lit(6))
                .otherwise(pl.lit(12))
                .alias("temporal_resolution_hours"),
                pl.when(pl.col("instrument") == "MODIS")
                .then(pl.lit("Moderate Resolution Imaging Spectroradiometer"))
                .when(pl.col("instrument") == "VIIRS")
                .then(pl.lit("Visible Infrared Imaging Radiometer Suite"))
                .otherwise(pl.lit("Unknown instrument"))
                .alias("description"),
            ]
        ).select(
            [
                "id",
                "satellite_name",
                "instrument",
                "version",
                "spatial_resolution_m",
                "temporal_resolution_hours",
                "description",
            ]
        )

        return dim_satellite

    def _create_dim_confidence(self, staging_hotspot: pl.DataFrame) -> pl.DataFrame:
        if staging_hotspot.is_empty():
            return pl.DataFrame()

        confidence_df = staging_hotspot.select(["confidence", "instrument"]).unique()

        dim_confidence = confidence_df.with_columns(
            [
                pl.struct(["confidence", "instrument"])
                .map_elements(
                    lambda row: self.id_mappings.get_confidence_id(
                        row["confidence"], row["instrument"]
                    ),
                    return_dtype=pl.Utf8,
                )
                .alias("id"),
                pl.col("confidence").alias("confidence_raw"),
                pl.col("instrument").alias("source_instrument"),
                pl.when(pl.col("instrument") == "MODIS")
                .then(
                    pl.when(pl.col("confidence").cast(pl.Int32, strict=False) >= 80)
                    .then(pl.lit("HIGH"))
                    .when(pl.col("confidence").cast(pl.Int32, strict=False) >= 30)
                    .then(pl.lit("NOMINAL"))
                    .otherwise(pl.lit("LOW"))
                )
                .when(pl.col("instrument") == "VIIRS")
                .then(
                    pl.when(pl.col("confidence").is_in(["h", "high"]))
                    .then(pl.lit("HIGH"))
                    .when(pl.col("confidence").is_in(["n", "nominal"]))
                    .then(pl.lit("NOMINAL"))
                    .otherwise(pl.lit("LOW"))
                )
                .otherwise(pl.lit("UNKNOWN"))
                .alias("confidence_class"),
                pl.when(pl.col("instrument") == "MODIS")
                .then(pl.col("confidence").cast(pl.Int32, strict=False))
                .when(pl.col("instrument") == "VIIRS")
                .then(
                    pl.when(pl.col("confidence").is_in(["h", "high"]))
                    .then(pl.lit(85))
                    .when(pl.col("confidence").is_in(["n", "nominal"]))
                    .then(pl.lit(50))
                    .otherwise(pl.lit(15))
                )
                .otherwise(pl.lit(0))
                .alias("confidence_numeric"),
                pl.when(pl.col("instrument") == "MODIS")
                .then(pl.col("confidence").cast(pl.Float32, strict=False) / 100.0)
                .when(pl.col("instrument") == "VIIRS")
                .then(
                    pl.when(pl.col("confidence").is_in(["h", "high"]))
                    .then(pl.lit(0.85))
                    .when(pl.col("confidence").is_in(["n", "nominal"]))
                    .then(pl.lit(0.50))
                    .otherwise(pl.lit(0.15))
                )
                .otherwise(pl.lit(0.0))
                .alias("confidence_score"),
                pl.when(pl.col("instrument") == "MODIS")
                .then(pl.lit("MODIS confidence percentage (0-100)"))
                .when(pl.col("instrument") == "VIIRS")
                .then(pl.lit("VIIRS confidence category (low/nominal/high)"))
                .otherwise(pl.lit("Unknown confidence format"))
                .alias("description"),
            ]
        ).select(
            [
                "id",
                "confidence_raw",
                "source_instrument",
                "confidence_class",
                "confidence_numeric",
                "confidence_score",
                "description",
            ]
        )

        return dim_confidence

    def _create_dim_weather_condition(
        self, staging_weather: pl.DataFrame
    ) -> pl.DataFrame:
        if staging_weather.is_empty():
            return pl.DataFrame()

        weather_df = staging_weather.select(["conditions", "icon"]).unique()

        dim_weather = weather_df.with_columns(
            [
                pl.col("conditions")
                .map_elements(
                    lambda x: self.id_mappings.get_weather_condition_id(x),
                    return_dtype=pl.Utf8,
                )
                .alias("id")
            ]
        ).select(["id", "conditions", "icon"])

        return dim_weather

    async def _create_fact_hotspot(
        self, staging_hotspot: pl.DataFrame, staging_weather: pl.DataFrame
    ) -> pl.DataFrame:
        if staging_hotspot.is_empty():
            return pl.DataFrame()

        fact_df = staging_hotspot.with_columns(
            [pl.col("acq_time").cast(pl.Utf8).str.zfill(4).alias("time_str")]
        ).with_columns(
            [
                (
                    pl.col("acq_date").cast(pl.Utf8)
                    + " "
                    + pl.col("time_str").str.slice(0, 2)
                    + ":"
                    + pl.col("time_str").str.slice(2, 2)
                    + ":00"
                )
                .str.strptime(pl.Datetime, "%Y-%m-%d %H:%M:%S")
                .dt.replace_time_zone("UTC")
                .dt.replace_time_zone(None)
                .alias("acquired_at"),
                pl.col("acq_date")
                .cast(pl.Utf8)
                .map_elements(
                    lambda x: self.id_mappings.get_time_id(x), return_dtype=pl.Utf8
                )
                .alias("period_id"),
            ]
        )

        unique_coords = fact_df.select(["latitude", "longitude"]).unique()
        location_mapping = await self._get_location_mapping(unique_coords)

        if not location_mapping.is_empty():
            fact_df = fact_df.join(
                location_mapping, on=["latitude", "longitude"], how="left"
            )
        else:
            fact_df = fact_df.with_columns(pl.lit("").alias("location_id"))

        fact_df = fact_df.with_columns([pl.col("location_id").fill_null("")])

        original_count = len(fact_df)
        fact_df = fact_df.filter(pl.col("location_id") != "")
        filtered_count = len(fact_df)
        rejected_count = original_count - filtered_count

        if rejected_count > 0:
            logger.warning(
                f"Filtered out {rejected_count} fact_hotspot records with no valid location_id"
            )

        if fact_df.is_empty():
            logger.warning("No fact_hotspot records with valid location_id")
            return pl.DataFrame()

        hotspot_ids = [str(ULID()) for _ in range(len(fact_df))]

        fact_hotspot = fact_df.with_columns(
            [
                pl.Series("id", hotspot_ids, dtype=pl.Utf8),
                (pl.col("satellite") + "_" + pl.col("instrument")).alias(
                    "satellite_id"
                ),
                pl.struct(["confidence", "instrument"])
                .map_elements(
                    lambda row: self.id_mappings.get_confidence_id(
                        row["confidence"], row["instrument"]
                    ),
                    return_dtype=pl.Utf8,
                )
                .alias("confidence_id"),
                pl.col("frp").cast(pl.Float32),
                pl.col("brightness").cast(pl.Float32),
                pl.col("bright_t31").cast(pl.Float32),
                pl.col("bright_ti4").cast(pl.Float32),
                pl.col("bright_ti5").cast(pl.Float32),
                pl.col("scan").cast(pl.Float32),
                pl.col("track").cast(pl.Float32),
            ]
        ).select(
            [
                "id",
                "satellite_id",
                "confidence_id",
                "period_id",
                "location_id",
                "acquired_at",
                "frp",
                "brightness",
                "bright_t31",
                "bright_ti4",
                "bright_ti5",
                "latitude",
                "longitude",
                "scan",
                "track",
            ]
        )

        return fact_hotspot

    async def _create_fact_weather(self, staging_weather: pl.DataFrame) -> pl.DataFrame:
        if staging_weather.is_empty():
            return pl.DataFrame()

        weather_ids = [str(ULID()) for _ in range(len(staging_weather))]

        unique_coords = staging_weather.select(["latitude", "longitude"]).unique()
        location_mapping = await self._get_location_mapping(unique_coords)

        fact_temp = staging_weather.with_columns(
            [
                pl.Series("id", weather_ids, dtype=pl.Utf8),
                pl.col("datetime")
                .str.strptime(pl.Datetime, "%Y-%m-%d %H:%M:%S.%f")
                .dt.replace_time_zone("UTC")
                .dt.replace_time_zone(None)
                .alias("acquired_at"),
                pl.col("datetime")
                .str.strptime(pl.Datetime, "%Y-%m-%d %H:%M:%S.%f")
                .dt.date()
                .cast(pl.Utf8)
                .map_elements(
                    lambda x: self.id_mappings.get_time_id(x), return_dtype=pl.Utf8
                )
                .alias("period_id"),
                pl.col("conditions")
                .map_elements(
                    lambda x: self.id_mappings.get_weather_condition_id(x),
                    return_dtype=pl.Utf8,
                )
                .alias("weather_condition_id"),
                pl.col("temperature").cast(pl.Int16),
                pl.col("humidity").cast(pl.Float32),
                pl.col("wind_speed").cast(pl.Float32),
                pl.col("wind_degree").cast(pl.Float32),
                pl.col("visibility").cast(pl.UInt16),
                pl.col("cloud_coverage").cast(pl.UInt8),
                pl.col("pressure").cast(pl.UInt16),
                pl.col("uv_index").cast(pl.UInt8),
                pl.col("precipitation").cast(pl.Float32),
                pl.col("solar_radiation").cast(pl.Float32),
            ]
        )

        if not location_mapping.is_empty():
            fact_temp = fact_temp.join(
                location_mapping, on=["latitude", "longitude"], how="left"
            )
        else:
            fact_temp = fact_temp.with_columns(pl.lit("").alias("location_id"))

        fact_temp = fact_temp.with_columns([pl.col("location_id").fill_null("")])

        original_count = len(fact_temp)
        fact_temp = fact_temp.filter(pl.col("location_id") != "")
        filtered_count = len(fact_temp)
        rejected_count = original_count - filtered_count

        if rejected_count > 0:
            logger.warning(
                f"Filtered out {rejected_count} fact_weather records with no valid location_id"
            )

        if fact_temp.is_empty():
            logger.warning("No fact_weather records with valid location_id")
            return pl.DataFrame()

        fact_temp = fact_temp.select(
            [
                "id",
                "period_id",
                "location_id",
                "weather_condition_id",
                "acquired_at",
                "temperature",
                "humidity",
                "wind_speed",
                "wind_degree",
                "visibility",
                "cloud_coverage",
                "latitude",
                "longitude",
                "pressure",
                "uv_index",
                "precipitation",
                "solar_radiation",
            ]
        )

        return fact_temp

    async def _get_location_mapping(self, coords_df: pl.DataFrame) -> pl.DataFrame:
        if not self.loader or coords_df.is_empty():
            return pl.DataFrame()

        try:
            all_results = []
            batch_size = 1000

            total_coords = len(coords_df)
            logger.info(
                f"Loading location mapping for {total_coords} coordinates in batches of {batch_size}"
            )

            for batch_start in range(0, total_coords, batch_size):
                batch_end = min(batch_start + batch_size, total_coords)
                batch_df = coords_df[batch_start:batch_end]

                lat_list = ",".join(
                    [f"'{row['latitude']}'" for row in batch_df.iter_rows(named=True)]
                )
                lon_list = ",".join(
                    [f"'{row['longitude']}'" for row in batch_df.iter_rows(named=True)]
                )

                query = f"""
                SELECT latitude, longitude, id as location_id
                FROM dim_location
                WHERE latitude IN ({lat_list})
                  AND longitude IN ({lon_list})
                """

                result = await self.loader.execute_query(query + " FORMAT CSVWithNames")

                if result.strip():
                    lines = result.strip().split("\n")
                    if len(lines) > 1:
                        csv_data = io.StringIO(result)
                        batch_result = pl.read_csv(
                            csv_data,
                            schema_overrides={
                                "latitude": pl.Utf8,
                                "longitude": pl.Utf8,
                                "location_id": pl.Utf8,
                            },
                        )
                        all_results.append(batch_result)

            if all_results:
                location_df = pl.concat(all_results, how="vertical").unique(
                    subset=["latitude", "longitude"]
                )
                logger.info(
                    f"Loaded location mapping for {len(location_df)} coordinates"
                )
                return location_df

            logger.warning("No location mapping found for provided coordinates")
            return pl.DataFrame()
        except Exception as e:
            logger.warning(f"Could not load location mapping: {e}")
            return pl.DataFrame()
