from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
import sys
import os
import asyncio
import traceback
import shutil
import polars as pl

sys.path.insert(0, '/opt/airflow')

from src.etl.staging_extractor import StagingExtractor
from src.etl.transformer import HotspotTransformer
from src.etl.loader import ClickHouseLoader
from src.utils.logging import setup_logging, get_logger
from src.etl.loader import ClickHouseLoader


setup_logging()
logger = get_logger(__name__)

dag = DAG(
    'hotspot_daily',
    default_args={
        'owner': 'zsbahtiar',
        'depends_on_past': False,
        'retries': 3,
        'retry_delay': timedelta(minutes=5),
    },
    description='Complete ETL: Extract Staging Transform Dimensional Hotspot Schema',
    schedule_interval=timedelta(minutes=15),
    start_date=datetime(2015, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=['hotspot', 'etl', 'hotspot-schema', 'production'],
)



def extract_to_staging(**context):
    date_str = datetime.now().strftime('%Y-%m-%d')

    logger.info(f"Starting staging extraction for {date_str} (today)")

    async def _extract():
        extractor = StagingExtractor()

        try:
            staging_data = await extractor.extract_to_staging(date_str)

            if not staging_data:
                logger.warning(f"No staging data extracted for {date_str}")
                return None

            staging_dir = f"/tmp/staging_{date_str}"
            os.makedirs(staging_dir, exist_ok=True)

            staging_files = {}
            for table_name, df in staging_data.items():
                file_path = f"{staging_dir}/{table_name}.csv"

                df.write_csv(file_path, quote_style='always')
                staging_files[table_name] = file_path
                logger.info(f"Saved {table_name} with {len(df)} records to {file_path}")

            batch_metadata = extractor.get_batch_metadata()
            batch_metadata['staging_files'] = staging_files
            batch_metadata['staging_dir'] = staging_dir

            logger.info(f"Staging extraction completed. Batch: {batch_metadata['batch_id']}")
            return batch_metadata

        except Exception as e:
            logger.error(f"Staging extraction failed: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise

    return asyncio.run(_extract())

def load_staging_to_clickhouse(**context):
    date_str = datetime.now().strftime('%Y-%m-%d')

    batch_metadata = context['task_instance'].xcom_pull(task_ids='extract_to_staging')
    if not batch_metadata:
        logger.error("No batch metadata found, cannot load staging data")
        return None

    logger.info(f"Loading staging data to ClickHouse for {date_str}")
    logger.info(f"Batch ID: {batch_metadata['batch_id']}")

    async def _load():
        loader = ClickHouseLoader()

        try:
            staging_files = batch_metadata.get('staging_files', {})
            tables_loaded = []

            for table_name, file_path in staging_files.items():
                if os.path.exists(file_path):
                    logger.info(f"Loading {table_name} from {file_path}")

                    df = pl.read_csv(file_path)

                    await loader.load_staging_table(table_name, df)

                    tables_loaded.append(f"{table_name}: {len(df)} records")
                    logger.info(f"Successfully loaded {table_name} with {len(df)} records")
                else:
                    logger.warning(f"Staging file not found: {file_path}")

            logger.info(f"Staging load completed: {tables_loaded}")
            return {
                'batch_id': batch_metadata['batch_id'],
                'tables_loaded': tables_loaded,
                'status': 'loaded_to_staging'
            }

        except Exception as e:
            logger.error(f"Staging load error: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise

    try:
        return asyncio.run(_load())
    except Exception as e:
        logger.error(f"AsyncIO error: {e}")
        raise


def transform_to_hotspot(**context):
    date_str = datetime.now().strftime('%Y-%m-%d')

    load_result = context['task_instance'].xcom_pull(task_ids='load_staging_to_clickhouse')
    if not load_result:
        logger.error("No staging load result found, cannot transform to hotspot")
        return None
    batch_id = load_result['batch_id']

    logger.info(f"Starting hotspot transformation for {date_str}, batch: {batch_id}")

    async def _transform():
        transformer = HotspotTransformer()
        loader = ClickHouseLoader()

        try:
            dimensional_data = await transformer.transform_staging_to_hotspot(batch_id)

            if not dimensional_data:
                logger.warning(f"No dimensional data created for batch {batch_id}")
                return None

            tables_loaded = []

            dimension_order = [
                ('dim_period', 'load_dimension_insert_only'),
                ('dim_location', 'load_dimension_upsert', 'id'),
                ('dim_satellite', 'load_dimension_small'),
                ('dim_confidence', 'load_dimension_small'),
                ('dim_weather_condition', 'load_dimension_small')
            ]

            for dim_config in dimension_order:
                table_name = dim_config[0]
                if table_name in dimensional_data:
                    df = dimensional_data[table_name]
                    if not df.is_empty():
                        logger.info(f"Loading {table_name} with {len(df)} records")

                        if dim_config[1] == 'load_dimension_insert_only':
                            await loader.load_dimension_insert_only(table_name, df)
                        elif dim_config[1] == 'load_dimension_upsert':
                            await loader.load_dimension_upsert(table_name, df, dim_config[2])
                        elif dim_config[1] == 'load_dimension_small':
                            await loader.load_dimension_small(table_name, df)

                        tables_loaded.append(f"{table_name}: {len(df)} records")

            fact_tables = ['fact_hotspot', 'fact_weather']
            for table_name in fact_tables:
                if table_name in dimensional_data:
                    df = dimensional_data[table_name]
                    if not df.is_empty():
                        logger.info(f"Loading {table_name} with {len(df)} records")
                        await loader.load_fact_with_staging(table_name, df, date_str)
                        tables_loaded.append(f"{table_name}: {len(df)} records")

            logger.info(f"Hotspot transformation completed: {tables_loaded}")
            return {
                'batch_id': batch_id,
                'tables_loaded': tables_loaded,
                'status': 'hotspot_loaded'
            }

        except Exception as e:
            logger.error(f"Hotspot transformation error: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise

    try:
        return asyncio.run(_transform())
    except Exception as e:
        logger.error(f"AsyncIO error: {e}")
        raise

def data_quality_check(**context):
    date_str = datetime.now().strftime('%Y-%m-%d')

    transform_result = context['task_instance'].xcom_pull(task_ids='transform_to_hotspot')
    if not transform_result:
        logger.warning("No hotspot transform result, checking staging only")
        load_result = context['task_instance'].xcom_pull(task_ids='load_staging_to_clickhouse')
        if not load_result:
            logger.error("No data found in pipeline")
            return "FAILED"
        batch_id = load_result['batch_id']
    else:
        batch_id = transform_result['batch_id']

    logger.info(f"Running complete data quality checks for {date_str}")
    logger.info(f"Checking batch: {batch_id}")

    async def _check():
        loader = ClickHouseLoader()

        try:
            checks_passed = 0
            total_checks = 9 

            staging_tables = ['staging_hotspot', 'staging_weather']
            for table in staging_tables:
                try:
                    count = await loader.get_table_count(table)
                    logger.info(f"{table}: {count} records")
                    if count > 0:
                        checks_passed += 1
                except Exception as e:
                    logger.warning(f"Could not check {table}: {e}")

            dimension_tables = ['dim_period', 'dim_location', 'dim_satellite', 'dim_confidence', 'dim_weather_condition']
            for table in dimension_tables:
                try:
                    count = await loader.get_table_count(table)
                    logger.info(f"{table}: {count} records")
                    if count > 0:
                        checks_passed += 1
                except Exception as e:
                    logger.warning(f"Could not check {table}: {e}")

            fact_tables = ['fact_hotspot', 'fact_weather']
            for table in fact_tables:
                try:
                    count = await loader.get_table_count(table)
                    logger.info(f"{table}: {count} records")
                    if count > 0:
                        checks_passed += 1
                except Exception as e:
                    logger.warning(f"Could not check {table}: {e}")

            success_rate = (checks_passed / total_checks) * 100
            logger.info(f"Data quality check: {checks_passed}/{total_checks} passed ({success_rate:.1f}%)")

            if checks_passed >= 8:  
                logger.info("Data quality checks passed!")
                return "SUCCESS"
            elif checks_passed >= 5:
                logger.warning(f"Partial success: {checks_passed}/{total_checks} checks passed")
                return "PARTIAL"
            else:
                logger.error("Data quality checks failed!")
                return "FAILED"

        except Exception as e:
            logger.error(f"Data quality check failed: {e}")
            return "FAILED"

    return asyncio.run(_check())

def cleanup_staging_temp_files(**context):
    date_str = datetime.now().strftime('%Y-%m-%d')

    batch_metadata = context['task_instance'].xcom_pull(task_ids='extract_to_staging')
    if not batch_metadata:
        logger.warning("No batch metadata found, skipping cleanup")
        return

    logger.info(f"Cleaning up staging temp files for {date_str}")

    staging_dir = batch_metadata.get('staging_dir')
    files_cleaned = 0

    if staging_dir and os.path.exists(staging_dir):
        try:
            shutil.rmtree(staging_dir)
            files_cleaned += 1
            logger.info(f"Removed staging directory: {staging_dir}")
        except Exception as e:
            logger.warning(f"Failed to remove staging directory {staging_dir}: {e}")

    logger.info(f"Staging cleanup completed: {files_cleaned} directories removed")

extract_to_staging_task = PythonOperator(
    task_id='extract_to_staging',
    python_callable=extract_to_staging,
    dag=dag,
)

load_staging_task = PythonOperator(
    task_id='load_staging_to_clickhouse',
    python_callable=load_staging_to_clickhouse,
    dag=dag,
)

transform_hotspot_task = PythonOperator(
    task_id='transform_to_hotspot',
    python_callable=transform_to_hotspot,
    dag=dag,
)

data_quality_task = PythonOperator(
    task_id='data_quality_check',
    python_callable=data_quality_check,
    dag=dag,
)

cleanup_staging_task = PythonOperator(
    task_id='cleanup_staging_temp_files',
    python_callable=cleanup_staging_temp_files,
    dag=dag,
)

extract_to_staging_task >> load_staging_task >> transform_hotspot_task >> data_quality_task >> cleanup_staging_task