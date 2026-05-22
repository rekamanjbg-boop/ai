from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    hermes_env: str = Field(default="development", alias="HERMES_ENV")
    hermes_host: str = Field(default="0.0.0.0", alias="HERMES_HOST")
    hermes_port: int = Field(default=8000, alias="HERMES_PORT")
    hermes_log_level: str = Field(default="info", alias="HERMES_LOG_LEVEL")
    redis_url: str = Field(default="redis://localhost:6379", alias="REDIS_URL")
    memory_prefix: str = Field(default="hermes:memory", alias="HERMES_MEMORY_PREFIX")
    orchestration_prefix: str = Field(default="hermes:orchestration", alias="HERMES_ORCHESTRATION_PREFIX")
    worker_stream: str = Field(default="hermes:worker_commands", alias="HERMES_WORKER_STREAM")
    event_stream: str = Field(default="hermes:events", alias="HERMES_EVENT_STREAM")
    memory_ttl_seconds: int = Field(default=0, alias="HERMES_MEMORY_TTL_SECONDS")
    sqlite_path: str = Field(default="/data/hermes/hermes-memory.sqlite3", alias="HERMES_SQLITE_PATH")
    codex_bridge_enabled: bool = Field(default=False, alias="CODEX_BRIDGE_ENABLED")
    codex_workspace_root: str = Field(default="/data/codex-workspaces", alias="CODEX_WORKSPACE_ROOT")
    codex_cli_command: str = Field(default="codex exec", alias="CODEX_CLI_COMMAND")
    codex_timeout_seconds: int = Field(default=900, alias="CODEX_TIMEOUT_SECONDS")
    codex_max_patch_bytes: int = Field(default=2_000_000, alias="CODEX_MAX_PATCH_BYTES")
    telegram_bot_token: str | None = Field(default=None, alias="TELEGRAM_BOT_TOKEN")
    telegram_default_chat_id: str | None = Field(default=None, alias="TELEGRAM_DEFAULT_CHAT_ID")


@lru_cache
def get_settings() -> Settings:
    return Settings()
