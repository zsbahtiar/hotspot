"""Async weather backfill (no queue table), mirroring the Cloudflare version.

Weather is optional and decoupled from hotspot ingest. The set of work that still
needs weather is derived directly from the data: any (location_id, period_id) that
has hotspots but no fact_weather row, within a recent window. A daily budget
counter in Redis caps VisualCrossing usage at the free plan (1000 records/day).
"""
from datetime import datetime, timedelta
from typing import Dict, List

import polars as pl
import redis
from ulid import ULID

from src.config import settings
from src.etl.clients import WeatherService
from src.etl.loader import ClickHouseLoader
from src.utils.logging import get_logger

logger = get_logger(__name__)


def _budget_key() -> str:
    return f"weather_budget:{datetime.utcnow().strftime('%Y-%m-%d')}"


def _redis():
    return redis.Redis(
        host=settings.redis_host,
        port=settings.redis_port,
        db=settings.redis_db,
        decode_responses=True,
    )


async def fetch_missing_weather(
    loader: ClickHouseLoader, since_date: str, limit: int
) -> List[Dict]:
    """One representative (location_id, period_id) still missing weather, recent first."""
    query = f"""
    SELECT
        fh.location_id AS location_id,
        fh.period_id AS period_id,
        any(fh.latitude) AS latitude,
        any(fh.longitude) AS longitude,
        toString(toDate(max(fh.acquired_at))) AS date_value
    FROM hotspot.fact_hotspot fh
    LEFT ANTI JOIN hotspot.fact_weather fw
        ON fh.location_id = fw.location_id AND fh.period_id = fw.period_id
    WHERE fh.acquired_at >= '{since_date}'
    GROUP BY fh.location_id, fh.period_id
    ORDER BY max(fh.acquired_at) DESC
    LIMIT {limit}
    """
    res = await loader.execute_query(query)
    jobs: List[Dict] = []
    for line in res.strip().split("\n"):
        if line:
            p = line.split("\t")
            if len(p) == 5:
                jobs.append(
                    dict(location_id=p[0], period_id=p[1], latitude=p[2], longitude=p[3], date_value=p[4])
                )
    return jobs


async def _load_existing_weather_conditions(loader: ClickHouseLoader) -> Dict[str, str]:
    m: Dict[str, str] = {}
    try:
        res = await loader.execute_query(
            "SELECT conditions, id FROM dim_weather_condition WHERE conditions != ''"
        )
        for line in res.strip().split("\n"):
            if line:
                parts = line.split("\t")
                if len(parts) >= 2:
                    m[parts[0]] = parts[1]
    except Exception as e:
        logger.warning(f"Could not load weather conditions: {e}")
    return m


async def run_backfill(
    loader: ClickHouseLoader,
    daily_budget: int = 1000,
    batch: int = 80,
    window_days: int = 30,
) -> Dict:
    """Fetch weather for up to `batch` missing (location, period) pairs within budget."""
    # daily_budget > 0 caps VisualCrossing usage per day (free plan);
    # 0 disables the cap entirely (paid plan / unlimited).
    capped = daily_budget > 0
    r = _redis()
    used = int(r.get(_budget_key()) or 0) if capped else 0
    remaining = (daily_budget - used) if capped else None
    if capped and remaining <= 0:
        logger.info(f"Weather budget exhausted for today ({used}/{daily_budget})")
        return {"status": "budget_exhausted", "used": used}

    take = min(remaining, batch) if capped else batch
    since = (datetime.utcnow() - timedelta(days=window_days)).strftime("%Y-%m-%d 00:00:00")
    jobs = await fetch_missing_weather(loader, since, take)
    if not jobs:
        return {"status": "empty", "processed": 0}

    weather_service = WeatherService()
    cond_map = await _load_existing_weather_conditions(loader)

    rows: List[Dict] = []
    calls = 0
    failed = 0
    for j in jobs:
        calls += 1
        try:
            data = await weather_service.get_weather_by_coordinates(
                float(j["longitude"]), float(j["latitude"]), j["date_value"]
            )
            day = (data.get("days") or [{}])[0] if isinstance(data, dict) else {}
            if not day:
                failed += 1
                continue

            conditions = str(day.get("conditions", ""))
            if conditions not in cond_map:
                cond_map[conditions] = str(ULID())
            rows.append(
                {
                    "id": str(ULID()),
                    "period_id": j["period_id"],
                    "location_id": j["location_id"],
                    "weather_condition_id": cond_map[conditions],
                    "acquired_at": f"{j['date_value']} 00:00:00.000",
                    "temperature": int(round(float(day.get("temp", 0) or 0))),
                    "humidity": float(day.get("humidity", 0) or 0),
                    "wind_speed": float(day.get("windspeed", 0) or 0),
                    "wind_degree": float(day.get("winddir", 0) or 0),
                    "visibility": int(round(float(day.get("visibility", 0) or 0))),
                    "cloud_coverage": int(round(float(day.get("cloudcover", 0) or 0))),
                    "latitude": j["latitude"],
                    "longitude": j["longitude"],
                    "pressure": int(round(float(day.get("pressure", 0) or 0))),
                    "uv_index": int(round(float(day.get("uvindex", 0) or 0))),
                    "precipitation": float(day.get("precip", 0) or 0),
                    "solar_radiation": float(day.get("solarradiation", 0) or 0),
                    "_conditions": conditions,
                    "_icon": str(day.get("icon", "")),
                }
            )
        except Exception as e:
            logger.warning(f"Weather fetch failed for {j.get('latitude')},{j.get('longitude')}: {e}")
            failed += 1

    # Count every VC call against today's budget (only when capping).
    if capped and calls:
        r.incrby(_budget_key(), calls)
        r.expire(_budget_key(), 172800)

    # Upsert new dim_weather_condition rows, then insert fact_weather.
    new_conditions: Dict[str, tuple] = {}
    for row in rows:
        new_conditions.setdefault(row["_conditions"], (cond_map[row["_conditions"]], row["_icon"]))
    dim_rows = [
        {"id": cid, "conditions": c, "icon": icon} for c, (cid, icon) in new_conditions.items()
    ]
    if dim_rows:
        await loader.load_dimension_small("dim_weather_condition", pl.DataFrame(dim_rows))
    if rows:
        fact_df = pl.DataFrame(
            [{k: v for k, v in row.items() if not k.startswith("_")} for row in rows]
        )
        await loader.insert_csv_data("fact_weather", fact_df)

    logger.info(
        f"Weather backfill: {len(rows)} loaded, {failed} failed, budget {used + calls}/{daily_budget}"
    )
    return {"status": "ok", "processed": len(jobs), "loaded": len(rows), "failed": failed, "budget_used": used + calls}
