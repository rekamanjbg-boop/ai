from fastapi import Request

from hermes.application.orchestrator import Orchestrator
from hermes.core.config import get_settings
from hermes.infrastructure.memory_store import SQLiteMemoryStore
from hermes.infrastructure.redis_client import RedisClient


def get_orchestrator(request: Request) -> Orchestrator:
    redis: RedisClient = request.app.state.redis
    memory_store: SQLiteMemoryStore = request.app.state.memory_store
    return Orchestrator(redis=redis, memory_store=memory_store, settings=get_settings())
