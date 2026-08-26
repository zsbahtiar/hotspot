"""Weather backfill DAG: drains weather_queue within the VisualCrossing free
budget (1000 records/day) and loads fact_weather, decoupled from hotspot ingest.

Runs frequently but each run is capped by both a per-run batch size and the
shared daily budget, so it self-throttles to stay on the free plan.
"""
import asyncio
import os
import sys
import traceback
from datetime import datetime, timedelta

import redis
from airflow import DAG
from airflow.operators.python import PythonOperator

sys.path.insert(0, "/opt/airflow")

from src.config import settings
from src.etl.loader import ClickHouseLoader
from src.etl.weather_backfill import run_backfill
from src.utils.logging import get_logger, setup_logging

setup_logging()
logger = get_logger(__name__)

# WEATHER_DAILY_BUDGET: >0 caps VisualCrossing usage per day (free plan);
# 0 disables the cap (paid plan / unlimited).
DAILY_BUDGET = int(os.environ.get("WEATHER_DAILY_BUDGET", "1000"))
PER_RUN_BATCH = int(os.environ.get("WEATHER_BATCH", "80"))

dag = DAG(
    "hotspot_weather_backfill",
    default_args={
        "owner": "zsbahtiar",
        "depends_on_past": False,
        "retries": 2,
        "retry_delay": timedelta(minutes=5),
    },
    description="Async weather enrichment: drain weather_queue within the VC free budget",
    schedule_interval=timedelta(minutes=10),
    start_date=datetime(2015, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["hotspot", "etl", "weather", "backfill"],
)


def backfill_weather(**context):
    async def _run():
        loader = ClickHouseLoader()
        try:
            return await run_backfill(loader, daily_budget=DAILY_BUDGET, batch=PER_RUN_BATCH)
        except Exception as e:
            logger.error(f"Weather backfill failed: {e}")
            logger.error(traceback.format_exc())
            raise

    result = asyncio.run(_run())
    logger.info(f"Weather backfill result: {result}")
    return result


def invalidate_api_cache(**context):
    result = context["task_instance"].xcom_pull(task_ids="backfill_weather")
    if not result or result.get("loaded", 0) <= 0:
        logger.info("No weather loaded, skipping cache invalidation")
        return {"status": "skipped"}

    try:
        r = redis.Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            db=settings.redis_db,
            decode_responses=True,
        )
        keys = r.smembers("api_cache_keys")
        deleted = 0
        for key in keys or []:
            try:
                r.delete(key)
                deleted += 1
            except Exception as e:
                logger.warning(f"Failed to delete cache key {key}: {e}")
        r.delete("api_cache_keys")
        logger.info(f"Invalidated {deleted} API cache keys after weather backfill")
        return {"status": "success", "keys_deleted": deleted}
    except Exception as e:
        logger.error(f"Cache invalidation failed: {e}")
        return {"status": "failed", "error": str(e)}


backfill_task = PythonOperator(
    task_id="backfill_weather",
    python_callable=backfill_weather,
    dag=dag,
)

invalidate_cache_task = PythonOperator(
    task_id="invalidate_api_cache",
    python_callable=invalidate_api_cache,
    dag=dag,
)

backfill_task >> invalidate_cache_task
