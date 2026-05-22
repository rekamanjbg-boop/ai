import asyncio
import json
import sqlite3
from pathlib import Path
from typing import Any


class SQLiteMemoryStore:
    def __init__(self, sqlite_path: str):
        self.sqlite_path = sqlite_path
        self.connection: sqlite3.Connection | None = None

    async def connect(self) -> None:
        await asyncio.to_thread(self._connect)

    async def close(self) -> None:
        if self.connection:
            await asyncio.to_thread(self.connection.close)
            self.connection = None

    async def put_memory(self, record: dict[str, Any]) -> None:
        await asyncio.to_thread(self._put_memory, record)

    async def get_memory(self, namespace: str, key: str) -> dict[str, Any] | None:
        return await asyncio.to_thread(self._get_memory, namespace, key)

    async def list_memory(self, namespace: str, limit: int = 50) -> list[dict[str, Any]]:
        return await asyncio.to_thread(self._list_memory, namespace, limit)

    async def append_task_history(self, record: dict[str, Any]) -> None:
        await asyncio.to_thread(self._append_task_history, record)

    async def list_task_history(self, project_id: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        return await asyncio.to_thread(self._list_task_history, project_id, limit)

    def _connect(self) -> None:
        Path(self.sqlite_path).parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(self.sqlite_path, check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        self.connection.execute("PRAGMA journal_mode=WAL")
        self.connection.execute("PRAGMA synchronous=NORMAL")
        self.connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS agent_memory (
              namespace TEXT NOT NULL,
              key TEXT NOT NULL,
              value TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              PRIMARY KEY (namespace, key)
            );

            CREATE INDEX IF NOT EXISTS idx_agent_memory_namespace
              ON agent_memory(namespace, updated_at DESC);

            CREATE TABLE IF NOT EXISTS task_history (
              id TEXT PRIMARY KEY,
              project_id TEXT,
              task_type TEXT NOT NULL,
              status TEXT NOT NULL,
              payload TEXT NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_task_history_project
              ON task_history(project_id, created_at DESC);
            """
        )
        self.connection.commit()

    def _put_memory(self, record: dict[str, Any]) -> None:
        connection = self._connection()
        connection.execute(
            """
            INSERT INTO agent_memory(namespace, key, value, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(namespace, key) DO UPDATE SET
              value = excluded.value,
              updated_at = excluded.updated_at
            """,
            (
                record["namespace"],
                record["key"],
                json.dumps(record["value"]),
                record["updated_at"],
            ),
        )
        connection.commit()

    def _get_memory(self, namespace: str, key: str) -> dict[str, Any] | None:
        row = self._connection().execute(
            """
            SELECT namespace, key, value, updated_at
            FROM agent_memory
            WHERE namespace = ? AND key = ?
            """,
            (namespace, key),
        ).fetchone()

        return memory_from_row(row) if row else None

    def _list_memory(self, namespace: str, limit: int) -> list[dict[str, Any]]:
        rows = self._connection().execute(
            """
            SELECT namespace, key, value, updated_at
            FROM agent_memory
            WHERE namespace = ?
            ORDER BY updated_at DESC
            LIMIT ?
            """,
            (namespace, limit),
        ).fetchall()

        return [memory_from_row(row) for row in rows]

    def _append_task_history(self, record: dict[str, Any]) -> None:
        connection = self._connection()
        connection.execute(
            """
            INSERT INTO task_history(id, project_id, task_type, status, payload, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                record["id"],
                record.get("project_id"),
                record["task_type"],
                record["status"],
                json.dumps(record["payload"]),
                record["created_at"],
            ),
        )
        connection.commit()

    def _list_task_history(self, project_id: str | None, limit: int) -> list[dict[str, Any]]:
        if project_id:
            rows = self._connection().execute(
                """
                SELECT id, project_id, task_type, status, payload, created_at
                FROM task_history
                WHERE project_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (project_id, limit),
            ).fetchall()
        else:
            rows = self._connection().execute(
                """
                SELECT id, project_id, task_type, status, payload, created_at
                FROM task_history
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

        return [task_from_row(row) for row in rows]

    def _connection(self) -> sqlite3.Connection:
        if not self.connection:
            raise RuntimeError("SQLiteMemoryStore is not connected")

        return self.connection


def memory_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "namespace": row["namespace"],
        "key": row["key"],
        "value": json.loads(row["value"]),
        "updated_at": row["updated_at"],
    }


def task_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "task_type": row["task_type"],
        "status": row["status"],
        "payload": json.loads(row["payload"]),
        "created_at": row["created_at"],
    }
