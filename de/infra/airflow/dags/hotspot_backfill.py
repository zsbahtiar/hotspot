from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator
import sys
import os
import io
import asyncio
import polars as pl
from ulid import ULID

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../../"))

from src.etl.clients import LocationService, WeatherService
from src.etl.loader import ClickHouseLoader
from src.etl.transformer import HotspotTransformer
from src.utils.logging import setup_logging, get_logger


setup_logging()
logger = get_logger(__name__)

default_args = {
    "owner": "zsbahtiar",
    "depends_on_past": False,
    "start_date": datetime(2015, 1, 1),
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 5,
    "retry_delay": timedelta(minutes=15),
}

dag = DAG(
    "hotspot_backfill",
    default_args=default_args,
    description="Backfill from january 2015 to current 03 October 2025",
    schedule_interval=timedelta(minutes=10),
    catchup=False,
    max_active_runs=1,
    tags=["etl", "hotspot", "backfill"],
)


def get_month_to_process(**context):
    async def _get_month():
        loader = ClickHouseLoader()

        query = """
        SELECT month, COUNT(*) as available_records
        FROM hotspot.backfill_state
        WHERE status = 'pending'
        GROUP BY month
        ORDER BY month ASC
        LIMIT 1
        """

        result = await loader.execute_query(query)
        if not result or not result.strip():
            logger.info("No more months to process")
            return None

        month = result.strip().split("\t")[0]
        record_count = result.strip().split("\t")[1]

        logger.info(f"Processing month {month} with {record_count} records")
        return month

    return asyncio.run(_get_month())


def process_month_data(**context):
    async def _process():
        loader = ClickHouseLoader()

        query = """
        SELECT month, COUNT(*) as available_records
        FROM hotspot.backfill_state
        WHERE status = 'pending' AND record_count <= 100000
        GROUP BY month
        ORDER BY SUM(record_count) ASC
        LIMIT 1
        """

        result = await loader.execute_query(query)
        if not result or not result.strip():
            logger.info("No more months to process")
            return {"status": "completed", "message": "Backfill completed"}

        month = result.strip().split("\t")[0]
        record_count = result.strip().split("\t")[1]

        logger.info(f"Processing month {month} with {record_count} records")

        logger.info(f"Starting backfill for month: {month}")

        location_service = LocationService()
        weather_service = WeatherService()
        transformer = HotspotTransformer()

        query = f"""
        SELECT * FROM hotspot.backfill_hotspot
        WHERE toYYYYMM(acq_date) = '{month}'
        ORDER BY acq_date, acq_time
        """

        result = await loader.execute_query(query + " FORMAT CSVWithNames")
        if not result or not result.strip():
            logger.warning(f"No data found for month {month}")
            return None

        line_count = len(result.split("\n")) if result else 0
        record_count = max(0, line_count - 1)
        logger.info(
            f"Query response received: {record_count} records, {len(result)} characters"
        )

        try:
            schema_overrides = {
                "version": pl.Utf8,
                "confidence": pl.Utf8,
                "satellite": pl.Utf8,
                "instrument": pl.Utf8,
                "daynight": pl.Utf8,
                "latitude": pl.Utf8,
                "longitude": pl.Utf8,
                "acq_date": pl.Utf8,
                "acq_time": pl.Utf8,
            }

            df = pl.read_csv(io.StringIO(result), schema_overrides=schema_overrides)
            logger.info(f"Successfully parsed CSV, DataFrame shape: {df.shape}")
        except Exception as e:
            logger.error(f"CSV parsing failed: {e}")
            logger.error(f"Response preview: {result[:500]}...")
            raise

        batch_id = str(ULID())
        logger.info(f"Batch ID: {batch_id}")
        ingested_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        df = df.with_columns(
            [
                pl.lit(batch_id).alias("batch_id"),
                pl.lit(ingested_at).alias("ingested_at"),
            ]
        )

        logger.info(f"Extracted {len(df)} records for month {month}")

        await loader.load_staging_table("staging_hotspot", df)
        logger.info(f"Loaded {len(df)} records to staging_hotspot")

        unique_coords = df.select(["latitude", "longitude"]).unique()
        logger.info(f"Processing {len(unique_coords)} unique coordinates")

        location_records = unique_coords.to_dicts()
        weather_records = df.to_dicts()

        logger.info("Fetching location and weather data concurrently")

        location_task = location_service.get_location_bulk(
            location_records,
            concurrent=False,
        )

        weather_task = weather_service.get_weather_bulk(
            weather_records,
            concurrent=False,
        )

        locations, weather_data = await asyncio.gather(location_task, weather_task)

        if locations:
            region_cols = [
                "province_code",
                "province_name",
                "city_code",
                "city_name",
                "district_code",
                "district_name",
                "subdistrict_code",
                "subdistrict_name",
            ]

            coord_region_df = pl.DataFrame(locations).select(
                ["latitude", "longitude"] + region_cols
            )

            region_map = {}
            cols_str = ", ".join(region_cols)
            existing = await loader.execute_query(
                f"SELECT {cols_str}, id FROM dim_location FORMAT TabSeparated"
            )
            if existing.strip():
                for line in existing.strip().split("\n"):
                    parts = line.split("\t")
                    if len(parts) == len(region_cols) + 1:
                        region_map[tuple(parts[: len(region_cols)])] = parts[-1]

            unique_regions = coord_region_df.select(region_cols).unique()
            region_ids = []
            for row in unique_regions.iter_rows(named=True):
                key = tuple(row[c] for c in region_cols)
                if key not in region_map:
                    region_map[key] = str(ULID())
                region_ids.append(region_map[key])

            dim_region_df = unique_regions.with_columns(
                [pl.Series("id", region_ids, dtype=pl.Utf8)]
            ).select(["id"] + region_cols)
            await loader.load_dimension_composite_key(
                "dim_location", dim_region_df, region_cols
            )

            coord_region_df = coord_region_df.with_columns(
                [
                    pl.struct(region_cols)
                    .map_elements(
                        lambda r: region_map[tuple(r[c] for c in region_cols)],
                        return_dtype=pl.Utf8,
                    )
                    .alias("location_id")
                ]
            )
            cache_df = coord_region_df.select(
                ["latitude", "longitude", "location_id"]
            )
            await loader.load_dimension_composite_key(
                "geo_coordinate_cache", cache_df, ["latitude", "longitude"]
            )
            logger.info(
                f"Loaded {len(dim_region_df)} regions, cached {len(cache_df)} coordinates"
            )

        if weather_data:
            for weather in weather_data:
                weather["batch_id"] = batch_id
                weather["ingested_at"] = datetime.now().strftime(
                    "%Y-%m-%d %H:%M:%S.%f"
                )[:-3]

            column_order = [
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

            weather_df = pl.DataFrame(weather_data).select(column_order)
            await loader.load_staging_table("staging_weather", weather_df)
            logger.info(f"Loaded {len(weather_df)} weather records")

        logger.info("Transforming to dimensional model")
        dimensional_data = await transformer.transform_staging_to_hotspot(batch_id)

        dimension_order = [
            ("dim_period", "load_dimension_insert_only"),
            ("dim_satellite", "load_dimension_small"),
            ("dim_confidence", "load_dimension_small"),
            ("dim_weather_condition", "load_dimension_small"),
        ]

        for table_name, load_method in dimension_order:
            if table_name in dimensional_data:
                df_data = dimensional_data[table_name]
                if not df_data.is_empty():
                    if load_method == "load_dimension_insert_only":
                        await loader.load_dimension_insert_only(table_name, df_data)
                    elif load_method == "load_dimension_small":
                        await loader.load_dimension_small(table_name, df_data)
                    logger.info(f"Loaded {table_name} with {len(df_data)} records")

        for table_name, df_data in dimensional_data.items():
            if not df_data.is_empty() and table_name.startswith("fact_"):
                month_end = f"{month[:4]}-{month[4:]}-28"
                await loader.load_fact_with_staging(table_name, df_data, month_end)
                logger.info(f"Loaded {table_name} with {len(df_data)} records")

        await loader.execute_query(
            f"DELETE FROM hotspot.backfill_state WHERE month = '{month}'"
        )

        await loader.execute_query(
            f"INSERT INTO hotspot.backfill_state (month, status, record_count, last_processed) "
            f"VALUES ('{month}', 'completed', {len(df)}, now64())"
        )

        logger.info(f"Successfully processed month {month}: {len(df)} records")

        return {"month": month, "record_count": len(df), "batch_id": batch_id}

    return asyncio.run(_process())


def validate_monthly_processing(**context):
    process_result = context["task_instance"].xcom_pull(task_ids="process_month_data")
    if not process_result:
        logger.error("No processing result found")
        return False

    if process_result.get("status") == "completed":
        logger.info("Backfill completed - validation passed")
        return True

    month = process_result.get("month")
    record_count = process_result.get("record_count", 0)

    logger.info(f"Validation for month {month}: {record_count} records processed")

    if record_count == 0:
        logger.warning(f"No records processed for month {month}")
        return False

    return True


process_month_task = PythonOperator(
    task_id="process_month_data",
    python_callable=process_month_data,
    dag=dag,
)

validate_month_task = PythonOperator(
    task_id="validate_monthly_processing",
    python_callable=validate_monthly_processing,
    dag=dag,
)

cleanup_task = BashOperator(
    task_id="cleanup_temp_files",
    bash_command='find /tmp -name "*staging_*" -type d -mtime +1 -exec rm -rf {} +',
    dag=dag,
    trigger_rule="all_done",
)

process_month_task >> validate_month_task >> cleanup_task
