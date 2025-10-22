import asyncio
from datetime import datetime
from io import StringIO
from typing import Dict, List, Optional
import polars as pl
import time
import json
import random
from functools import wraps
from src.config import settings
from src.utils.logging import get_logger
from src.utils.connections import redis_manager, http_manager

logger = get_logger(__name__)


def retry_with_exponential_backoff(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    backoff_factor: float = 2.0,
    retryable_status_codes: List[int] = None
):
    if retryable_status_codes is None:
        retryable_status_codes = [502, 503, 504, 429]

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None

            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)

                except Exception as e:
                    last_exception = e

                    should_retry = False
                    error_message = str(e).lower()

                    for status_code in retryable_status_codes:
                        if f"{status_code}" in error_message:
                            should_retry = True
                            break

                    network_error_patterns = [
                        "connection", "timeout", "server error",
                        "temporary", "unavailable", "overloaded"
                    ]
                    for pattern in network_error_patterns:
                        if pattern in error_message:
                            should_retry = True
                            break

                    if not should_retry or attempt == max_retries:
                        if attempt == max_retries:
                            logger.error(
                                f"Max retries ({max_retries}) exceeded for {func.__name__}: {e}"
                            )
                        else:
                            logger.error(f"Non-retryable error in {func.__name__}: {e}")
                        raise

                    delay = min(base_delay * (backoff_factor ** attempt), max_delay)
                    jitter = random.uniform(0.1, 0.3) * delay
                    total_delay = delay + jitter

                    logger.warning(
                        f"Attempt {attempt + 1}/{max_retries + 1} failed for {func.__name__}: {e}. "
                        f"Retrying in {total_delay:.2f} seconds..."
                    )

                    await asyncio.sleep(total_delay)

            raise last_exception

        return wrapper
    return decorator


class RateLimiter:
    def __init__(self, max_requests: int = 4500, time_window: int = 600):
        self.max_requests = max_requests
        self.time_window = time_window
        self.requests = []

    async def acquire(self):
        now = time.time()
        self.requests = [
            req_time for req_time in self.requests if now - req_time < self.time_window
        ]

        if len(self.requests) >= self.max_requests:
            sleep_time = self.time_window - (now - self.requests[0]) + 1
            logger.warning(f"Rate limit reached, sleeping for {sleep_time:.1f} seconds")
            await asyncio.sleep(sleep_time)
            self.requests = []

        self.requests.append(now)


class NASAFIRMSClient:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.nasa_firms_api_key
        self.base_url = settings.nasa_firms_base_url
        self.rate_limiter = RateLimiter()

    async def get_hotspots(
        self, country: str = "IDN", source: str = "MODIS_NRT", day_range: int = 1
    ) -> pl.DataFrame:
        if not self.api_key:
            raise ValueError("NASA FIRMS API key not configured")

        indonesia_bbox = "95,-11,141,6"
        url = f"{self.base_url}/api/area/csv/{self.api_key}/{source}/{indonesia_bbox}/{day_range}"

        try:
            await self.rate_limiter.acquire()
            client = http_manager.get_client()
            response = await client.get(url)
            response.raise_for_status()

            response_text = response.text.strip()

            if "Invalid" in response_text or "Error" in response_text:
                logger.error(f"NASA FIRMS API error: {response_text}")
                return pl.DataFrame()

            lines = response_text.split("\n")
            if len(lines) <= 1:
                logger.warning(f"No hotspot data for {source} in last {day_range} days")
                return pl.DataFrame()

            df = pl.read_csv(StringIO(response_text))

            if df.is_empty():
                logger.warning(f"Empty dataframe for {source}")
                return pl.DataFrame()

            required_cols = ["latitude", "longitude", "acq_date", "acq_time"]
            missing_cols = [col for col in required_cols if col not in df.columns]
            if missing_cols:
                logger.error(f"Missing required columns for {source}: {missing_cols}")
                return pl.DataFrame()

            logger.info(
                f"Retrieved {len(df)} hotspots from {source} (last {day_range} days)"
            )
            return df

        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error fetching hotspots from {source}: {e}")
            return pl.DataFrame()
        except Exception as e:
            logger.error(f"Error fetching hotspots from {source}: {e}")
            return pl.DataFrame()

    async def get_hotspots_bulk(
        self, start_date: str, end_date: str, sources: List[str] = None
    ) -> pl.DataFrame:
        if not sources:
            sources = ["MODIS_NRT", "VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT"]

        all_data = []
        date_range = pl.date_range(
            start=datetime.strptime(start_date, "%Y-%m-%d"),
            end=datetime.strptime(end_date, "%Y-%m-%d"),
            interval="1d",
            eager=True,
        )

        for date in date_range:
            date_str = date.strftime("%Y-%m-%d")
            for source in sources:
                try:
                    df = await self.get_hotspots(source=source, date=date_str)
                    if not df.is_empty():
                        df = df.with_columns(pl.lit(source).alias("source"))
                        all_data.append(df)
                    await asyncio.sleep(2)
                except Exception as e:
                    logger.error(f"Failed to fetch {source} for {date_str}: {e}")

        if all_data:
            return pl.concat(all_data, how="vertical")
        return pl.DataFrame()


class LocationService:
    def __init__(self):
        self.base_url = settings.bmkg_api_base_url

    @retry_with_exponential_backoff(
        max_retries=3,
        base_delay=2.0,
        max_delay=30.0,
        backoff_factor=2.0,
        retryable_status_codes=[502, 503, 504, 429, 500]
    )
    async def get_location_by_coordinates(
        self, longitude: float, latitude: float
    ) -> Dict:
        url = f"{self.base_url}/df/v1/adm/coord"
        params = {"lat": latitude, "lon": longitude}

        client = http_manager.get_client()
        response = await client.get(url, params=params)
        response.raise_for_status()
        location = response.json()

        if location.get("kecamatan") is None:
            logger.warning(
                f"Coordinate {latitude},{longitude} rejected: kecamatan is null (not in Indonesia)"
            )
            return {}

        desa = location.get("desa", "")
        if not desa or desa == "Area Tidak Terdefinisi":
            logger.warning(
                f"Coordinate {latitude},{longitude} rejected: desa is undefined (not in Indonesia)"
            )
            return {}

        return location

    async def get_location_bulk(
        self,
        hotspot_records: List[Dict],
        concurrent: bool = False,
        max_concurrent: int = 10
    ) -> List[Dict]:
        if concurrent:
            return await self._get_location_bulk_concurrent(
                hotspot_records, max_concurrent
            )
        else:
            return await self._get_location_bulk_sequential(hotspot_records)

    async def _get_location_bulk_sequential(self, hotspot_records: List[Dict]) -> List[Dict]:
        redis_client = await redis_manager.get_client()

        location_data = []
        unique_coords = list(
            dict.fromkeys([(r["longitude"], r["latitude"]) for r in hotspot_records])
        )
        total_coords = len(unique_coords)
        batch_size = settings.batch_size

        logger.info(f"Processing {total_coords} unique coordinates (sequential)")

        processed = 0
        for batch_start in range(0, total_coords, batch_size):
            batch_end = min(batch_start + batch_size, total_coords)
            batch_coords = unique_coords[batch_start:batch_end]
            batch_api_hits = 0

            for lon, lat in batch_coords:
                processed += 1
                api_hit = False
                try:
                    geo_cache_key = f"geo_bmkg:{lat}:{lon}"
                    geo_cached = await redis_client.get(geo_cache_key)

                    if geo_cached:
                        location = json.loads(geo_cached)
                    else:
                        location = await self.get_location_by_coordinates(lon, lat)
                        api_hit = True
                        batch_api_hits += 1
                        if location:
                            ttl_seconds = settings.bmkg_cache_ttl_hours * 24 * 3600
                            await redis_client.setex(
                                geo_cache_key, ttl_seconds, json.dumps(location)
                            )

                    if location:
                        location_record = {
                            "longitude": str(lon),
                            "latitude": str(lat),
                            "province_code": location.get("adm1", ""),
                            "city_code": location.get("adm2", ""),
                            "district_code": location.get("adm3", ""),
                            "subdistrict_code": location.get("adm4", ""),
                            "province_name": location.get("provinsi", ""),
                            "city_name": location.get("kotkab", ""),
                            "district_name": location.get("kecamatan", ""),
                            "subdistrict_name": location.get("desa", ""),
                        }
                        location_data.append(location_record)

                    if processed % 100 == 0:
                        logger.info(f"Geocoded {processed}/{total_coords} coordinates")

                    if api_hit:
                        await asyncio.sleep(settings.bmkg_request_delay_seconds)

                except Exception as e:
                    logger.error(f"Failed to geocode {lat}, {lon}: {e}")

            if batch_end < total_coords and batch_api_hits > 0:
                logger.info(
                    f"Batch Location complete ({batch_api_hits} API hits). Waiting {settings.bmkg_batch_delay_seconds}s..."
                )
                await asyncio.sleep(settings.bmkg_batch_delay_seconds)

        logger.info(f"Completed geocoding {len(location_data)} locations")
        return location_data

    async def _get_location_bulk_concurrent(
        self, hotspot_records: List[Dict], max_concurrent: int = 10
    ) -> List[Dict]:
        redis_client = await redis_manager.get_client()

        location_data = []
        unique_coords = list(
            dict.fromkeys([(r["longitude"], r["latitude"]) for r in hotspot_records])
        )
        total_coords = len(unique_coords)

        logger.info(
            f"Processing {total_coords} unique coordinates "
            f"(concurrent, max={max_concurrent})"
        )

        semaphore = asyncio.Semaphore(max_concurrent)

        async def geocode_single(lon: float, lat: float) -> Optional[Dict]:
            async with semaphore:
                try:
                    geo_cache_key = f"geo_bmkg:{lat}:{lon}"
                    geo_cached = await redis_client.get(geo_cache_key)

                    if geo_cached:
                        location = json.loads(geo_cached)
                    else:
                        location = await self.get_location_by_coordinates(lon, lat)
                        if location:
                            ttl_seconds = settings.bmkg_cache_ttl_hours * 24 * 3600
                            await redis_client.setex(
                                geo_cache_key, ttl_seconds, json.dumps(location)
                            )
                        await asyncio.sleep(settings.bmkg_request_delay_seconds)

                    if location:
                        return {
                            "longitude": str(lon),
                            "latitude": str(lat),
                            "province_code": location.get("adm1", ""),
                            "city_code": location.get("adm2", ""),
                            "district_code": location.get("adm3", ""),
                            "subdistrict_code": location.get("adm4", ""),
                            "province_name": location.get("provinsi", ""),
                            "city_name": location.get("kotkab", ""),
                            "district_name": location.get("kecamatan", ""),
                            "subdistrict_name": location.get("desa", ""),
                        }
                    return None
                except Exception as e:
                    logger.error(f"Failed to geocode {lat}, {lon}: {e}")
                    return None

        tasks = [geocode_single(lon, lat) for lon, lat in unique_coords]

        results = []
        for i in range(0, len(tasks), 100):
            batch_tasks = tasks[i:i+100]
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)

            for result in batch_results:
                if isinstance(result, Exception):
                    logger.error(f"Geocoding error: {result}")
                elif result is not None:
                    results.append(result)

            logger.info(f"Geocoded {min(i+100, len(tasks))}/{len(tasks)} coordinates")

        logger.info(f"Completed concurrent geocoding: {len(results)} locations")
        return results


class WeatherService:
    def __init__(self):
        self.base_url = settings.visualcrossing_base_url
        self.api_key = settings.visualcrossing_api_key

    @retry_with_exponential_backoff(
        max_retries=3,
        base_delay=2.0,
        max_delay=30.0,
        backoff_factor=2.0,
        retryable_status_codes=[502, 503, 504, 429, 500, 422]
    )
    async def get_weather_by_coordinates(
        self, longitude: float, latitude: float, datetime_str: str = None
    ) -> Dict:
        if not self.api_key:
            raise ValueError("Visual Crossing API key not configured")

        if datetime_str:
            url = f"{self.base_url}/{latitude},{longitude}/{datetime_str}"
        else:
            url = f"{self.base_url}/{latitude},{longitude}"

        params = {
            "key": self.api_key,
            "include": "current",
            "unitGroup": "metric",
            "timezone": "Z",
        }

        client = http_manager.get_client()
        response = await client.get(url, params=params)
        response.raise_for_status()
        return response.json()

    async def get_weather_bulk(
        self,
        hotspot_records: List[Dict],
        concurrent: bool = False,
        max_concurrent: int = 10
    ) -> List[Dict]:
        if concurrent:
            return await self._get_weather_bulk_concurrent(
                hotspot_records, max_concurrent
            )
        else:
            return await self._get_weather_bulk_sequential(hotspot_records)

    async def _get_weather_bulk_sequential(self, hotspot_records: List[Dict]) -> List[Dict]:
        redis_client = await redis_manager.get_client()

        weather_data = []
        unique_coords = list(
            dict.fromkeys(
                [
                    (r["longitude"], r["latitude"], r["acq_date"], r["acq_time"])
                    for r in hotspot_records
                ]
            )
        )
        total_coords = len(unique_coords)
        batch_size = settings.batch_size

        logger.info(f"Processing {total_coords} unique weather coordinates (sequential)")

        processed = 0
        for batch_start in range(0, total_coords, batch_size):
            batch_end = min(batch_start + batch_size, total_coords)
            batch_coords = unique_coords[batch_start:batch_end]
            batch_api_hits = 0

            for lon, lat, acq_date, acq_time in batch_coords:
                processed += 1
                api_hit = False
                try:
                    time_str = str(acq_time).zfill(4)

                    datetime_str = f"{acq_date}T{time_str[0:2]}:{time_str[2:4]}:00"

                    weather_cache_key = f"weather_vc:{lat}:{lon}:{acq_date}:{acq_time}"
                    weather_cached = await redis_client.get(weather_cache_key)

                    if weather_cached:
                        weather = json.loads(weather_cached)
                    else:
                        weather = await self.get_weather_by_coordinates(
                            lon, lat, datetime_str
                        )
                        api_hit = True
                        batch_api_hits += 1
                        if weather:
                            ttl_seconds = settings.visualcrossing_cache_ttl_hours * 3600
                            await redis_client.setex(
                                weather_cache_key, ttl_seconds, json.dumps(weather)
                            )

                    if weather:
                        weather_record = self._extract_weather_data(
                            weather, lon, lat, acq_date, acq_time
                        )
                        weather_data.append(weather_record)

                    if processed % 100 == 0:
                        logger.info(
                            f"Fetched weather for {processed}/{total_coords} coordinates"
                        )

                    if api_hit:
                        await asyncio.sleep(settings.bmkg_request_delay_seconds)

                except Exception as e:
                    logger.error(f"Failed to fetch weather for {lat}, {lon}: {e}")

            if batch_end < total_coords and batch_api_hits > 0:
                logger.info(
                    f"Batch Weather complete ({batch_api_hits} API hits). Waiting {settings.visualcrossing_request_delay_seconds}s..."
                )
                await asyncio.sleep(settings.visualcrossing_request_delay_seconds)

        logger.info(f"Completed fetching {len(weather_data)} weather records")
        return weather_data

    async def _get_weather_bulk_concurrent(
        self, hotspot_records: List[Dict], max_concurrent: int = 10
    ) -> List[Dict]:
        redis_client = await redis_manager.get_client()

        weather_data = []
        unique_coords = list(
            dict.fromkeys(
                [
                    (r["longitude"], r["latitude"], r["acq_date"], r["acq_time"])
                    for r in hotspot_records
                ]
            )
        )
        total_coords = len(unique_coords)

        logger.info(
            f"Processing {total_coords} unique weather coordinates "
            f"(concurrent, max={max_concurrent})"
        )

        semaphore = asyncio.Semaphore(max_concurrent)

        async def fetch_weather_single(
            lon: float, lat: float, acq_date: str, acq_time: str
        ) -> Optional[Dict]:
            async with semaphore:
                try:
                    time_str = str(acq_time).zfill(4)
                    datetime_str = f"{acq_date}T{time_str[0:2]}:{time_str[2:4]}:00"

                    weather_cache_key = f"weather_vc:{lat}:{lon}:{acq_date}:{acq_time}"
                    weather_cached = await redis_client.get(weather_cache_key)

                    if weather_cached:
                        weather = json.loads(weather_cached)
                    else:
                        weather = await self.get_weather_by_coordinates(lon, lat, datetime_str)
                        if weather:
                            ttl_seconds = settings.visualcrossing_cache_ttl_hours * 3600
                            await redis_client.setex(
                                weather_cache_key, ttl_seconds, json.dumps(weather)
                            )
                        await asyncio.sleep(settings.visualcrossing_request_delay_seconds)

                    if weather:
                        return self._extract_weather_data(weather, lon, lat, acq_date, acq_time)
                    return None
                except Exception as e:
                    logger.error(f"Failed to fetch weather for {lat}, {lon}: {e}")
                    return None

        tasks = [
            fetch_weather_single(lon, lat, acq_date, acq_time)
            for lon, lat, acq_date, acq_time in unique_coords
        ]

        results = []
        for i in range(0, len(tasks), 100):
            batch_tasks = tasks[i:i+100]
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)

            for result in batch_results:
                if isinstance(result, Exception):
                    logger.error(f"Weather fetch error: {result}")
                elif result is not None:
                    results.append(result)

            logger.info(f"Fetched weather for {min(i+100, len(tasks))}/{len(tasks)} coordinates")

        logger.info(f"Completed concurrent weather fetch: {len(results)} records")
        return results

    def _extract_weather_data(
        self, weather: Dict, lon: float, lat: float, acq_date: str, acq_time: str
    ) -> Dict:
        current = weather.get("currentConditions", {})

        time_str = str(acq_time).zfill(4)
        weather_time = f"{time_str[0:2]}:{time_str[2:4]}:00"
        full_datetime = f"{acq_date} {weather_time}"

        return {
            "longitude": str(lon),
            "latitude": str(lat),
            "datetime": full_datetime,
            "conditions": current.get("conditions", ""),
            "icon": current.get("icon", ""),
            "temperature": int(round(float(current.get("temp", 0) or 0))),
            "feels_like": current.get("feelslike", 0) or 0,
            "humidity": current.get("humidity", 0) or 0,
            "precipitation": current.get("precip", 0) or 0,
            "precip_prob": int(round(float(current.get("precipprob", 0) or 0))),
            "wind_speed": current.get("windspeed", 0) or 0,
            "wind_degree": current.get("winddir", 0) or 0,
            "wind_gust": current.get("windgust", 0) or 0,
            "pressure": int(round(float(current.get("pressure", 0) or 0))),
            "visibility": int(round(float(current.get("visibility", 0) or 0))),
            "cloud_coverage": int(round(float(current.get("cloudcover", 0) or 0))),
            "solar_radiation": current.get("solarradiation", 0) or 0,
            "solar_energy": current.get("solarenergy", 0) or 0,
            "uv_index": int(round(float(current.get("uvindex", 0) or 0))),
            "severe_risk": int(round(float(current.get("severerisk", 0) or 0))),
        }
