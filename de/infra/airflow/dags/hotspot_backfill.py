from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../'))

from src.etl.clients import NASAFIRMSClient
from src.utils.logging import setup_logging, get_logger
import asyncio
import pandas as pd


setup_logging()
logger = get_logger(__name__)

default_args = {
    'owner': 'hotspot-team',
    'depends_on_past': False,
    'start_date': datetime(2024, 12, 1),
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 5,
    'retry_delay': timedelta(minutes=10),
}

dag = DAG(
    'hotspot_backfill',
    default_args=default_args,
    description='Backfill historical hotspot data from 2015-2025',
    schedule_interval=None,
    catchup=False,
    tags=['hotspot', 'backfill', 'historical'],
)


def backfill_year_data(**context):
    year = context['dag_run'].conf.get('year', 2024)
    start_month = context['dag_run'].conf.get('start_month', 1)
    end_month = context['dag_run'].conf.get('end_month', 12)
    
    logger.info(f"Starting backfill for year {year}, months {start_month}-{end_month}")
    
    async def _backfill():
        client = NASAFIRMSClient()
        try:
            sources = ["MODIS_NRT", "VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT"]
            if year >= 2024:
                sources.append("VIIRS_NOAA21_NRT")
            elif year < 2018:
                sources = ["MODIS_NRT", "VIIRS_SNPP_NRT"]
            
            all_data = []
            
            for month in range(start_month, end_month + 1):
                start_date = f"{year}-{month:02d}-01"
                
                if month == 12:
                    end_date = f"{year}-12-31"
                else:
                    end_date = f"{year}-{month+1:02d}-01"
                    end_date = (pd.to_datetime(end_date) - timedelta(days=1)).strftime('%Y-%m-%d')
                
                logger.info(f"Backfilling {year}-{month:02d} from {start_date} to {end_date}")
                
                month_data = await client.get_hotspots_bulk(start_date, end_date, sources)
                if not month_data.empty:
                    month_data['backfill_timestamp'] = datetime.now()
                    month_data['backfill_year'] = year
                    month_data['backfill_month'] = month
                    all_data.append(month_data)
                    
                await asyncio.sleep(1)
            
            if all_data:
                combined_df = pd.concat(all_data, ignore_index=True)
                csv_path = f"/tmp/backfill_hotspots_{year}_{start_month}_{end_month}.csv"
                combined_df.to_csv(csv_path, index=False)
                logger.info(f"Backfilled {len(combined_df)} hotspots for {year} to {csv_path}")
                return csv_path
            else:
                logger.warning(f"No backfill data found for {year}")
                return None
                
        finally:
            await client.close()
    
    return asyncio.run(_backfill())


def validate_backfill_data(**context):
    year = context['dag_run'].conf.get('year', 2024)
    
    backfill_file = context['task_instance'].xcom_pull(task_ids='backfill_year')
    if not backfill_file:
        logger.error(f"No backfill data found for {year}")
        return False
        
    df = pd.read_csv(backfill_file)
    
    expected_min_records = 1000 if year >= 2019 else 500
    if len(df) < expected_min_records:
        logger.warning(f"Low record count for {year}: {len(df)} < {expected_min_records}")
    
    missing_coords = df[['latitude', 'longitude']].isna().sum().sum()
    if missing_coords > 0:
        logger.error(f"Found {missing_coords} missing coordinates")
        return False
    
    indonesia_bounds = {
        'lat_min': -11, 'lat_max': 6,
        'lon_min': 95, 'lon_max': 141
    }
    
    out_of_bounds = (
        (df['latitude'] < indonesia_bounds['lat_min']) |
        (df['latitude'] > indonesia_bounds['lat_max']) |
        (df['longitude'] < indonesia_bounds['lon_min']) |
        (df['longitude'] > indonesia_bounds['lon_max'])
    ).sum()
    
    if out_of_bounds > len(df) * 0.1:
        logger.error(f"Too many out-of-bounds coordinates: {out_of_bounds}")
        return False
    
    logger.info(f"Validation passed for {year}: {len(df)} records")
    return True


def load_backfill_to_clickhouse(**context):
    year = context['dag_run'].conf.get('year', 2024)
    
    validation_result = context['task_instance'].xcom_pull(task_ids='validate_backfill')
    if not validation_result:
        logger.error(f"Validation failed, skipping load for {year}")
        return
    
    backfill_file = context['task_instance'].xcom_pull(task_ids='backfill_year')
    if not backfill_file:
        logger.error(f"No backfill data to load for {year}")
        return
        
    logger.info(f"Loading backfill data to ClickHouse for {year}")
    
    df = pd.read_csv(backfill_file)
    
    df['acq_datetime'] = pd.to_datetime(df['acq_date'] + ' ' + df['acq_time'].astype(str).str.zfill(4), format='%Y-%m-%d %H%M')
    df['country_code'] = 'IDN'
    
    processed_path = f"/tmp/processed_backfill_{year}.csv"
    df.to_csv(processed_path, index=False)
    
    logger.info(f"Processed and ready to load {len(df)} records for {year}")


backfill_task = PythonOperator(
    task_id='backfill_year',
    python_callable=backfill_year_data,
    dag=dag,
)

validate_task = PythonOperator(
    task_id='validate_backfill',
    python_callable=validate_backfill_data,
    dag=dag,
)

load_task = PythonOperator(
    task_id='load_backfill',
    python_callable=load_backfill_to_clickhouse,
    dag=dag,
)

cleanup_task = BashOperator(
    task_id='cleanup_temp_files',
    bash_command='find /tmp -name "*backfill*" -type f -mtime +1 -delete',
    dag=dag,
)

backfill_task >> validate_task >> load_task >> cleanup_task