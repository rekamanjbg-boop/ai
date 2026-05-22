from typing import Any

import orjson
from redis.asyncio import Redis


class RedisClient:
    def __init__(self, redis_url: str):
        self.client = Redis.from_url(redis_url, decode_responses=False)

    async def ping(self) -> bool:
        return bool(await self.client.ping())

    async def close(self) -> None:
        await self.client.aclose()

    async def get_json(self, key: str) -> dict[str, Any] | None:
        value = await self.client.get(key)
        return orjson.loads(value) if value else None

    async def set_json(self, key: str, value: dict[str, Any], ttl_seconds: int = 0) -> None:
        encoded = orjson.dumps(value)

        if ttl_seconds > 0:
            await self.client.set(key, encoded, ex=ttl_seconds)
            return

        await self.client.set(key, encoded)

    async def xadd(self, stream: str, value: dict[str, Any]) -> str:
        encoded = {
            key: orjson.dumps(item).decode("utf-8") if isinstance(item, (dict, list)) else str(item)
            for key, item in value.items()
        }
        stream_id = await self.client.xadd(stream, encoded)
        return stream_id.decode("utf-8") if isinstance(stream_id, bytes) else stream_id

