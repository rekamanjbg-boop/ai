from hermes.application.orchestrator import Orchestrator
from hermes.domain.models import (
    CreateOrchestrationRequest,
    DispatchRequest,
    NodeBridgeJobResponse,
    NodeBridgeStatusResponse,
)


async def create_node_bridge_job(
    orchestrator: Orchestrator,
    request: CreateOrchestrationRequest,
) -> NodeBridgeJobResponse:
    plan = await orchestrator.create_orchestration(request)
    await orchestrator.dispatch(plan.orchestration_id, DispatchRequest())

    return NodeBridgeJobResponse(
        job_id=plan.orchestration_id,
        orchestration_id=plan.orchestration_id,
        status="queued",
        links={
            "status": f"/v1/bridge/jobs/{plan.orchestration_id}/status",
            "orchestration": f"/v1/orchestrations/{plan.orchestration_id}",
        },
    )


async def get_node_bridge_status(
    orchestrator: Orchestrator,
    job_id: str,
) -> NodeBridgeStatusResponse | None:
    plan = await orchestrator.get_orchestration(job_id)

    if not plan:
        return None

    completed = sum(1 for stage in plan.stages if stage.status == "completed")
    total = len(plan.stages)
    percent = int((completed / total) * 100) if total else 0

    return NodeBridgeStatusResponse(
        job_id=plan.orchestration_id,
        orchestration_id=plan.orchestration_id,
        status=plan.status,
        progress={
            "completedStages": completed,
            "totalStages": total,
            "percent": percent,
            "stages": [stage.model_dump() for stage in plan.stages],
        },
        result=plan.model_dump() if plan.status == "completed" else None,
    )
