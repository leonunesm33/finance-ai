from redis.asyncio import Redis, from_url

from app.core.config import settings

redis_client: Redis = from_url(settings.REDIS_URL, decode_responses=True)


async def check_redis_connection() -> bool:
    return await redis_client.ping()
