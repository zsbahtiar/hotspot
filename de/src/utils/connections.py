import httpx
import redis.asyncio as redis
from typing import Optional
from src.config import settings
from src.utils.logging import get_logger

logger = get_logger(__name__)


class RedisConnectionManager:
    _instance: Optional["RedisConnectionManager"] = None
    _redis_client: Optional[redis.Redis] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    async def get_client(self) -> redis.Redis:
        if self._redis_client is None:
            logger.info("Initializing Redis connection pool")
            self._redis_client = await redis.from_url(
                f"redis://{settings.redis_host}:{settings.redis_port}",
                decode_responses=True,
                max_connections=10,
                socket_keepalive=True,
                socket_connect_timeout=5,
                retry_on_timeout=True,
            )
        return self._redis_client

    async def close(self):
        if self._redis_client:
            logger.info("Closing Redis connection pool")
            await self._redis_client.close()
            self._redis_client = None


class HTTPClientManager:
    _instance: Optional["HTTPClientManager"] = None
    _client: Optional[httpx.AsyncClient] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            logger.info("Initializing HTTP client with connection pooling")
            self._client = httpx.AsyncClient(
                timeout=30.0,
                limits=httpx.Limits(
                    max_connections=100,
                    max_keepalive_connections=20,
                    keepalive_expiry=30.0,
                ),
            )
        return self._client

    async def close(self):
        if self._client:
            logger.info("Closing HTTP client connection pool")
            await self._client.aclose()
            self._client = None


redis_manager = RedisConnectionManager()
http_manager = HTTPClientManager()
