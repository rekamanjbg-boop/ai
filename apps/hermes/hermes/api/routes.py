from fastapi import APIRouter, Depends, HTTPException

from hermes.api.dependencies import get_orchestrator
from hermes.application.node_bridge import create_node_bridge_job, get_node_bridge_status
from hermes.application.orchestrator import Orchestrator
from hermes.core.config import get_settings
from hermes.domain.models import CodexBridgeRequest, CreateOrchestrationRequest, DispatchRequest, PutMemoryRequest, TaskHistoryRequest

router = APIRouter()


@router.get("/health")
async def health(orchestrator: Orchestrator = Depends(get_orchestrator)):
    await orchestrator.redis.ping()
    settings = get_settings()
    return {
        "ok": True,
        "service": "hermes",
        "environment": settings.hermes_env,
    }


@router.get("/v1/queues/health")
async def queue_health(orchestrator: Orchestrator = Depends(get_orchestrator)):
    await orchestrator.redis.ping()
    settings = get_settings()

    return {
        "ok": True,
        "redis": "connected",
        "workerStream": settings.worker_stream,
        "eventStream": settings.event_stream,
    }


@router.post("/v1/orchestrations", status_code=202)
async def create_orchestration(
    payload: CreateOrchestrationRequest,
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    return await orchestrator.create_orchestration(payload)


@router.post("/v1/bridge/jobs", status_code=202)
async def create_bridge_job(
    payload: CreateOrchestrationRequest,
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    response = await create_node_bridge_job(orchestrator, payload)
    return response.model_dump(by_alias=True)


@router.get("/v1/bridge/jobs/{job_id}/status")
async def get_bridge_job_status(
    job_id: str,
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    response = await get_node_bridge_status(orchestrator, job_id)

    if not response:
        raise HTTPException(status_code=404, detail="Bridge job not found")

    return response.model_dump(by_alias=True)


@router.get("/v1/orchestrations/{orchestration_id}")
async def get_orchestration(
    orchestration_id: str,
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    plan = await orchestrator.get_orchestration(orchestration_id)

    if not plan:
        raise HTTPException(status_code=404, detail="Orchestration not found")

    return plan


@router.post("/v1/orchestrations/{orchestration_id}/dispatch", status_code=202)
async def dispatch_orchestration(
    orchestration_id: str,
    payload: DispatchRequest,
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    plan = await orchestrator.dispatch(orchestration_id, payload)

    if not plan:
        raise HTTPException(status_code=404, detail="Orchestration not found")

    return plan


@router.post("/v1/codex/runs", status_code=202)
async def run_codex_bridge(
    payload: CodexBridgeRequest,
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    try:
        return await orchestrator.run_codex_bridge(payload)
    except RuntimeError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/v1/memory/task-history", status_code=201)
async def append_task_history(
    payload: TaskHistoryRequest,
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    return await orchestrator.append_task_history(payload)


@router.get("/v1/memory/task-history")
async def list_task_history(
    project_id: str | None = None,
    limit: int = 50,
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    return await orchestrator.list_task_history(project_id, limit)


@router.put("/v1/memory/characters/{character_id}")
async def put_character_memory(
    character_id: str,
    payload: PutMemoryRequest,
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    return await orchestrator.put_character_memory(character_id, payload.value)


@router.get("/v1/memory/characters/{character_id}")
async def get_character_memory(
    character_id: str,
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    record = await orchestrator.get_character_memory(character_id)

    if not record:
        raise HTTPException(status_code=404, detail="Character memory not found")

    return record


@router.put("/v1/memory/prompts/{prompt_id}")
async def put_prompt_memory(
    prompt_id: str,
    payload: PutMemoryRequest,
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    return await orchestrator.put_prompt_memory(prompt_id, payload.value)


@router.put("/v1/memory/workflows/{workflow_id}")
async def put_workflow_memory(
    workflow_id: str,
    payload: PutMemoryRequest,
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    return await orchestrator.put_workflow_memory(workflow_id, payload.value)


@router.get("/v1/memory/{namespace}/{key}")
async def get_memory(
    namespace: str,
    key: str,
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    record = await orchestrator.get_memory(namespace, key)

    if not record:
        raise HTTPException(status_code=404, detail="Memory record not found")

    return record


@router.get("/v1/memory/{namespace}")
async def list_memory(
    namespace: str,
    limit: int = 50,
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    return await orchestrator.list_memory(namespace, limit)


@router.put("/v1/memory/{namespace}/{key}")
async def put_memory(
    namespace: str,
    key: str,
    payload: PutMemoryRequest,
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    return await orchestrator.put_memory(namespace, key, payload.value)
