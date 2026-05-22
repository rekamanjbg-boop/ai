from datetime import datetime, timezone

from hermes.application.planner import create_plan
from hermes.core.config import Settings
from hermes.domain.models import (
    CodexBridgeRequest,
    CodexBridgeResult,
    CreateOrchestrationRequest,
    DispatchRequest,
    MemoryRecord,
    OrchestrationPlan,
    TaskHistoryRecord,
    TaskHistoryRequest,
)
from hermes.application.codex_bridge import CodexBridge, codex_task_history
from hermes.infrastructure.memory_store import SQLiteMemoryStore
from hermes.infrastructure.redis_client import RedisClient


class Orchestrator:
    def __init__(self, redis: RedisClient, memory_store: SQLiteMemoryStore, settings: Settings):
        self.redis = redis
        self.memory_store = memory_store
        self.settings = settings

    async def create_orchestration(self, request: CreateOrchestrationRequest) -> OrchestrationPlan:
        plan = create_plan(request)
        await self.save_plan(plan)
        await self.append_task_history(TaskHistoryRequest(
            project_id=plan.project_id,
            task_type="orchestration.created",
            status=plan.status,
            payload=plan.model_dump(),
        ))
        await self.append_event("orchestration.planned", plan.orchestration_id, plan.model_dump())
        return plan

    async def get_orchestration(self, orchestration_id: str) -> OrchestrationPlan | None:
        data = await self.redis.get_json(self.plan_key(orchestration_id))
        return OrchestrationPlan.model_validate(data) if data else None

    async def dispatch(self, orchestration_id: str, request: DispatchRequest) -> OrchestrationPlan | None:
        plan = await self.get_orchestration(orchestration_id)

        if not plan:
            return None

        selected = set(request.stage_names or [stage.name for stage in plan.stages])
        plan.status = "dispatching"
        plan.updated_at = now()

        for stage in plan.stages:
            if stage.name not in selected:
                continue

            if stage.status != "pending" and not request.force:
                continue

            command = {
                "orchestrationId": plan.orchestration_id,
                "projectId": plan.project_id,
                "stage": stage.name,
                "worker": stage.worker,
                "payload": stage.payload,
            }
            await self.redis.xadd(self.settings.worker_stream, command)
            stage.status = "queued"

        plan.status = "queued"
        plan.updated_at = now()
        await self.save_plan(plan)
        await self.append_event("orchestration.dispatched", plan.orchestration_id, plan.model_dump())
        return plan

    async def put_memory(self, namespace: str, key: str, value: dict) -> MemoryRecord:
        record = MemoryRecord(namespace=namespace, key=key, value=value)
        await self.memory_store.put_memory(record.model_dump())
        await self.redis.set_json(
            self.memory_key(namespace, key),
            record.model_dump(),
            ttl_seconds=self.settings.memory_ttl_seconds,
        )
        return record

    async def get_memory(self, namespace: str, key: str) -> MemoryRecord | None:
        data = await self.redis.get_json(self.memory_key(namespace, key))

        if data:
            return MemoryRecord.model_validate(data)

        data = await self.memory_store.get_memory(namespace, key)

        if not data:
            return None

        await self.redis.set_json(
            self.memory_key(namespace, key),
            data,
            ttl_seconds=self.settings.memory_ttl_seconds,
        )
        return MemoryRecord.model_validate(data)

    async def list_memory(self, namespace: str, limit: int = 50) -> list[MemoryRecord]:
        rows = await self.memory_store.list_memory(namespace, limit)
        return [MemoryRecord.model_validate(row) for row in rows]

    async def append_task_history(self, request: TaskHistoryRequest) -> TaskHistoryRecord:
        record = TaskHistoryRecord(
            project_id=request.project_id,
            task_type=request.task_type,
            status=request.status,
            payload=request.payload,
        )
        await self.memory_store.append_task_history(record.model_dump())
        await self.redis.set_json(
            self.memory_key("task-history", record.id),
            record.model_dump(),
            ttl_seconds=self.settings.memory_ttl_seconds,
        )
        return record

    async def list_task_history(self, project_id: str | None = None, limit: int = 50) -> list[TaskHistoryRecord]:
        rows = await self.memory_store.list_task_history(project_id, limit)
        return [TaskHistoryRecord.model_validate(row) for row in rows]

    async def put_character_memory(self, character_id: str, value: dict) -> MemoryRecord:
        return await self.put_memory("character-continuity", character_id, value)

    async def get_character_memory(self, character_id: str) -> MemoryRecord | None:
        return await self.get_memory("character-continuity", character_id)

    async def put_prompt_memory(self, prompt_id: str, value: dict) -> MemoryRecord:
        return await self.put_memory("prompt-memory", prompt_id, value)

    async def put_workflow_memory(self, workflow_id: str, value: dict) -> MemoryRecord:
        return await self.put_memory("workflow-memory", workflow_id, value)

    async def run_codex_bridge(self, request: CodexBridgeRequest) -> CodexBridgeResult:
        result = await CodexBridge(self.redis, self.settings).run(request)
        await self.append_task_history(codex_task_history(result))
        await self.put_memory("code-review", result.run_id, {
            "projectId": result.project_id,
            "exitCode": result.exit_code,
            "review": result.review,
            "patchTruncated": result.patch_truncated,
            "createdAt": result.created_at,
        })
        return result

    async def save_plan(self, plan: OrchestrationPlan) -> None:
        await self.redis.set_json(self.plan_key(plan.orchestration_id), plan.model_dump())

    async def append_event(self, event_type: str, orchestration_id: str, payload: dict) -> None:
        await self.redis.xadd(
            self.settings.event_stream,
            {
                "type": event_type,
                "orchestrationId": orchestration_id,
                "payload": payload,
            },
        )

    def plan_key(self, orchestration_id: str) -> str:
        return f"{self.settings.orchestration_prefix}:{orchestration_id}"

    def memory_key(self, namespace: str, key: str) -> str:
        return f"{self.settings.memory_prefix}:{namespace}:{key}"


def now() -> str:
    return datetime.now(timezone.utc).isoformat()
