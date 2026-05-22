from contextlib import asynccontextmanager

from fastapi import FastAPI

from hermes.api.routes import router
from hermes.core.config import get_settings
from hermes.infrastructure.memory_store import SQLiteMemoryStore
from hermes.infrastructure.redis_client import RedisClient


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.redis = RedisClient(settings.redis_url)
    app.state.memory_store = SQLiteMemoryStore(settings.sqlite_path)
    await app.state.redis.ping()
    await app.state.memory_store.connect()
    yield
    await app.state.memory_store.close()
    await app.state.redis.close()


app = FastAPI(
    title="Hermes Orchestration Service",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(router)
