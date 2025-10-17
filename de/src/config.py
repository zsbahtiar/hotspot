from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_env: str = "development"
    app_debug: bool = True
    log_level: str = "INFO"
    airflow_web_port: int = 8080
    airflow_db_user: str = "airflow"
    airflow_db_password: str = "airflow"
    airflow_db_name: str = "airflow"
    airflow_db_port: int = 5433
    clickhouse_host: str = "clickhouse"
    clickhouse_port: int = 8123
    clickhouse_native_port: int = 9000
    clickhouse_db: str = "hotspot"
    clickhouse_user: str = "default"
    clickhouse_password: str = ""
    redis_host: str = "redis"
    redis_port: int = 6379
    redis_db: int = 0
    nasa_firms_api_key: Optional[str] = None
    nasa_firms_base_url: str = "https://firms.modaps.eosdis.nasa.gov/api"
    bmkg_api_base_url: str = "https://weather.bmkg.go.id/api"
    visualcrossing_api_key: Optional[str] = None
    visualcrossing_base_url: str = "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline"
    visualcrossing_cache_ttl_hours: int = 24
    visualcrossing_request_delay_seconds: float = 5
    batch_size: int = 1000
    max_retry_attempts: int = 3
    backfill_chunk_size: int = 7
    etl_schedule_interval: str = "*/15"
    nasa_rate_limit_requests: int = 4500
    nasa_rate_limit_window: int = 600
    bmkg_batch_size: int = 80
    bmkg_batch_delay_seconds: float = 5.0
    bmkg_request_delay_seconds: float = 0.1
    bmkg_cache_ttl_hours: int = 6 
    request_delay_seconds: float = 2.0
    backfill_delay_seconds: float = 5.0

    model_config = {"env_file": ".env", "case_sensitive": False, "extra": "ignore"}


settings = Settings()


def get_clickhouse_url() -> str:
    return f"clickhouse://{settings.clickhouse_user}:{settings.clickhouse_password}@{settings.clickhouse_host}:{settings.clickhouse_port}/{settings.clickhouse_db}"


def get_redis_url() -> str:
    return f"redis://{settings.redis_host}:{settings.redis_port}/{settings.redis_db}"