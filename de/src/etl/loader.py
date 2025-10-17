from typing import Dict
import polars as pl
import tempfile
from src.config import settings
from src.utils.logging import get_logger
from src.utils.connections import http_manager

logger = get_logger(__name__)


class ClickHouseLoader:
    def __init__(self):
        self.base_url = f"http://{settings.clickhouse_host}:{settings.clickhouse_port}"
        self.database = settings.clickhouse_db

    async def execute_query(self, query: str) -> str:
        try:
            client = http_manager.get_client()
            response = await client.post(
                f"{self.base_url}/", data=query, params={"database": self.database}
            )
            response.raise_for_status()
            return response.text
        except Exception as e:
            logger.error(f"ClickHouse query error: {e}")
            raise

    async def insert_csv_data(self, table_name: str, df: pl.DataFrame):
        if df.is_empty():
            logger.warning(f"DataFrame is empty, skipping insert to {table_name}")
            return

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False
        ) as tmp_file:
            include_header = "staging_" in table_name
            df.write_csv(
                tmp_file.name, include_header=include_header, quote_style="necessary"
            )

            with open(tmp_file.name, "rb") as csv_file:
                if "fact_hotspot" in table_name:
                    columns = ",".join(df.columns)
                    query = f"INSERT INTO {table_name} ({columns}) FORMAT CSV"
                elif "staging_" in table_name:
                    query = f"INSERT INTO {table_name} FORMAT CSVWithNames"
                elif "dim_confidence" in table_name:
                    columns = ",".join(df.columns)
                    query = f"INSERT INTO {table_name} ({columns}) FORMAT CSV"
                else:
                    query = f"INSERT INTO {table_name} FORMAT CSV"

                client = http_manager.get_client()
                response = await client.post(
                    f"{self.base_url}/",
                    params={"database": self.database, "query": query},
                    content=csv_file.read(),
                    headers={"Content-Type": "application/octet-stream"},
                )
                if response.status_code != 200:
                    logger.error(f"ClickHouse error response: {response.text}")
                response.raise_for_status()

    async def load_dimension_small(self, table_name: str, df: pl.DataFrame):
        if df.is_empty():
            logger.warning(f"{table_name} is empty, skipping load")
            return

        logger.info(f"Loading {len(df)} records to {table_name} (insert new only)")

        try:
            result = await self.execute_query(f"SELECT id FROM {table_name}")
            existing_ids = set(result.strip().split("\n")) if result.strip() else set()

            original_count = len(df)

            df = df.filter(~pl.col("id").is_in(existing_ids))

            if len(df) < original_count:
                logger.info(
                    f"Filtered out {original_count - len(df)} existing records from {table_name}"
                )

            if df.is_empty():
                logger.info(
                    f"All records already exist in {table_name}, skipping insert"
                )
                return

        except Exception as e:
            logger.warning(f"Could not check existing IDs: {e}, proceeding with insert")

        await self.insert_csv_data(table_name, df)

        logger.info(f"Successfully inserted {len(df)} new records to {table_name}")

    async def load_dimension_upsert(
        self, table_name: str, df: pl.DataFrame, key_col: str
    ):
        if df.is_empty():
            logger.warning(f"{table_name} is empty, skipping load")
            return

        logger.info(
            f"Loading {len(df)} records to {table_name} (insert new only, skip existing)"
        )

        try:
            result = await self.execute_query(f"SELECT {key_col} FROM {table_name}")
            existing_ids = set(result.strip().split("\n")) if result.strip() else set()

            original_count = len(df)
            df = df.filter(~pl.col(key_col).is_in(existing_ids))

            if len(df) < original_count:
                logger.info(
                    f"Filtered out {original_count - len(df)} existing records (by {key_col})"
                )

            if df.is_empty():
                logger.info(
                    f"All records already exist in {table_name}, skipping insert"
                )
                return
        except Exception as e:
            logger.warning(f"Could not check existing IDs: {e}, proceeding with insert")

        await self.insert_csv_data(table_name, df)
        logger.info(f"Successfully inserted {len(df)} new records to {table_name}")

    async def load_dimension_composite_key(
        self, table_name: str, df: pl.DataFrame, key_cols: list
    ):
        if df.is_empty():
            logger.warning(f"{table_name} is empty, skipping load")
            return

        logger.info(f"Loading {len(df)} records to {table_name} (composite key upsert)")

        try:
            key_cols_str = ", ".join(key_cols)
            result = await self.execute_query(
                f"SELECT {key_cols_str} FROM {table_name} FORMAT CSVWithNames"
            )

            if result.strip():
                import io

                existing_df = pl.read_csv(io.StringIO(result))

                for col in key_cols:
                    if col in existing_df.columns and col in df.columns:
                        existing_df = existing_df.with_columns(
                            pl.col(col).cast(df[col].dtype)
                        )

                original_count = len(df)
                df = df.join(existing_df, on=key_cols, how="anti")

                if len(df) < original_count:
                    logger.info(
                        f"Filtered out {original_count - len(df)} existing records (by {key_cols})"
                    )

                if df.is_empty():
                    logger.info(
                        f"All records already exist in {table_name}, skipping insert"
                    )
                    return
        except Exception as e:
            logger.warning(
                f"Could not check existing records: {e}, proceeding with insert"
            )

        await self.insert_csv_data(table_name, df)
        logger.info(f"Successfully inserted {len(df)} new records to {table_name}")

    async def load_dimension_insert_only(self, table_name: str, df: pl.DataFrame):
        if df.is_empty():
            logger.warning(f"{table_name} is empty, skipping load")
            return

        logger.info(
            f"Loading {len(df)} records to {table_name} (insert only, skip duplicates)"
        )

        if table_name == "dim_period" and "id" in df.columns:
            try:
                result = await self.execute_query(f"SELECT id FROM {table_name}")
                existing_ids = (
                    set(result.strip().split("\n")) if result.strip() else set()
                )

                original_count = len(df)
                df = df.filter(~pl.col("id").is_in(existing_ids))

                if len(df) < original_count:
                    logger.info(
                        f"Filtered out {original_count - len(df)} duplicate records (by ID)"
                    )

                if df.is_empty():
                    logger.info(
                        f"All records already exist in {table_name}, skipping insert"
                    )
                    return
            except Exception as e:
                logger.warning(
                    f"Could not check existing IDs: {e}, proceeding with insert"
                )

        await self.insert_csv_data(table_name, df)
        logger.info(f"Successfully loaded {len(df)} records to {table_name}")

    async def load_fact_with_staging(
        self, table_name: str, df: pl.DataFrame, date_str: str
    ):
        if df.is_empty():
            logger.warning(f"{table_name} is empty, skipping load")
            return

        logger.info(f"Loading {len(df)} records to {table_name} (daily staging)")

        staging_table = f"{table_name}_staging_{date_str.replace('-', '')}"

        try:
            await self.execute_query(f"CREATE TABLE {staging_table} AS {table_name}")
            await self.insert_csv_data(staging_table, df)

            await self.execute_query(f"""
            DELETE FROM {table_name}
            WHERE period_id IN (
                SELECT id FROM dim_period
                WHERE date_value = '{date_str}'
            )
            """)

            await self.execute_query(f"""
            INSERT INTO {table_name} SELECT * FROM {staging_table}
            """)

            logger.info(
                f"Successfully loaded {len(df)} records to {table_name} for {date_str}"
            )

        finally:
            await self.execute_query(f"DROP TABLE IF EXISTS {staging_table}")

    async def get_table_count(self, table_name: str) -> int:
        query = f"SELECT count() FROM {table_name}"
        result = await self.execute_query(query)
        return int(result.strip())

    async def load_staging_table(self, table_name: str, df: pl.DataFrame):
        if df.is_empty():
            logger.warning(f"{table_name} is empty, skipping load")
            return

        logger.info(f"Loading {len(df)} records to {table_name} (staging)")

        await self.insert_csv_data(table_name, df)
        logger.info(f"Successfully loaded {len(df)} records to {table_name}")

        try:
            optimize_query = f"OPTIMIZE TABLE {table_name} FINAL"
            await self.execute_query(optimize_query)

            count_query = f"SELECT count() FROM {table_name}"
            result = await self.execute_query(count_query)
            final_count = int(result.strip()) if result.strip() else 0

            logger.info(f"Optimized {table_name} - final count: {final_count} records")
        except Exception as e:
            logger.warning(f"Could not optimize {table_name}: {e}")

    async def load_hotspot_dimensions(self, dimensional_data: Dict[str, pl.DataFrame]):
        logger.info("Loading hotspot schema dimensions")
        dim_load_order = [
            ("dim_period", "load_dimension_insert_only"),
            ("dim_location", "load_dimension_upsert", "location_id"),
            ("dim_satellite", "load_dimension_small"),
            ("dim_confidence", "load_dimension_small"),
            ("dim_weather_condition", "load_dimension_small"),
        ]

        for dim_config in dim_load_order:
            table_name = dim_config[0]
            load_method = dim_config[1]

            if table_name in dimensional_data:
                df = dimensional_data[table_name]
                if not df.is_empty():
                    logger.info(f"Loading {table_name} with {len(df)} records")

                    if load_method == "load_dimension_insert_only":
                        await self.load_dimension_insert_only(table_name, df)
                    elif load_method == "load_dimension_upsert":
                        key_col = dim_config[2]
                        await self.load_dimension_upsert(table_name, df, key_col)
                    elif load_method == "load_dimension_small":
                        await self.load_dimension_small(table_name, df)
                else:
                    logger.warning(f"{table_name} is empty, skipping")
            else:
                logger.warning(f"{table_name} not found in dimensional data")

    async def get_staging_batch_status(self, batch_id: str) -> Dict:
        try:
            hotspot_query = f"SELECT count() as count FROM staging_hotspot WHERE batch_id = '{batch_id}'"
            hotspot_result = await self.execute_query(hotspot_query)
            hotspot_count = int(hotspot_result.strip()) if hotspot_result.strip() else 0

            weather_query = f"SELECT count() as count FROM staging_weather WHERE batch_id = '{batch_id}'"
            weather_result = await self.execute_query(weather_query)
            weather_count = int(weather_result.strip()) if weather_result.strip() else 0

            return {
                "batch_id": batch_id,
                "staging_hotspot_count": hotspot_count,
                "staging_weather_count": weather_count,
                "total_staging_records": hotspot_count + weather_count,
            }

        except Exception as e:
            logger.error(f"Error getting staging batch status: {e}")
            return {"batch_id": batch_id, "error": str(e)}

    async def get_dimensional_counts(self) -> Dict:
        tables = [
            "dim_period",
            "dim_location",
            "dim_satellite",
            "dim_confidence",
            "dim_weather_condition",
            "fact_hotspot",
            "fact_temperature",
        ]

        counts = {}
        for table in tables:
            try:
                count = await self.get_table_count(table)
                counts[table] = count
            except Exception as e:
                logger.warning(f"Could not get count for {table}: {e}")
                counts[table] = -1

        return counts
