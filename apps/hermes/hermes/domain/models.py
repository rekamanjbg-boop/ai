from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


MediaFormat = Literal["short", "reel", "story", "landscape"]
WorkerType = Literal["generation", "video-generation", "rendering", "delivery", "comfyui", "replicate-video", "remotion"]


class CreateOrchestrationRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    project_id: str = Field(
        min_length=1,
        validation_alias=AliasChoices("project_id", "projectId"),
    )
    prompt: str = Field(min_length=1)
    format: MediaFormat = "reel"
    assets: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class OrchestrationStage(BaseModel):
    name: str
    worker: WorkerType
    status: Literal["pending", "queued", "running", "completed", "failed"] = "pending"
    payload: dict[str, Any] = Field(default_factory=dict)


class OrchestrationPlan(BaseModel):
    orchestration_id: str = Field(default_factory=lambda: str(uuid4()))
    project_id: str
    prompt: str
    format: MediaFormat
    assets: list[str]
    metadata: dict[str, Any] = Field(default_factory=dict)
    stages: list[OrchestrationStage]
    status: Literal["planned", "dispatching", "queued", "completed", "failed"] = "planned"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class MemoryRecord(BaseModel):
    namespace: str
    key: str
    value: dict[str, Any]
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PutMemoryRequest(BaseModel):
    value: dict[str, Any]


class TaskHistoryRequest(BaseModel):
    project_id: str | None = None
    task_type: str = "generic"
    status: str = "completed"
    payload: dict[str, Any] = Field(default_factory=dict)


class TaskHistoryRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    project_id: str | None = None
    task_type: str
    status: str
    payload: dict[str, Any]
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CodexBridgeRequest(BaseModel):
    project_id: str = Field(min_length=1)
    task: str = Field(min_length=1)
    repo_url: str | None = None
    base_ref: str | None = None
    branch: str | None = None
    workspace_files: dict[str, str] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class CodexBridgeResult(BaseModel):
    run_id: str
    project_id: str
    workspace_path: str
    exit_code: int
    patch: str
    patch_truncated: bool
    stdout: str
    stderr: str
    review: dict[str, Any]
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class DispatchRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    stage_names: list[str] | None = Field(
        default=None,
        validation_alias=AliasChoices("stage_names", "stageNames"),
    )
    force: bool = False


class NodeBridgeJobResponse(BaseModel):
    job_id: str = Field(serialization_alias="jobId")
    orchestration_id: str = Field(serialization_alias="orchestrationId")
    status: str
    links: dict[str, str]


class NodeBridgeStatusResponse(BaseModel):
    job_id: str = Field(serialization_alias="jobId")
    orchestration_id: str = Field(serialization_alias="orchestrationId")
    status: str
    queue: str = "hermes"
    progress: dict[str, Any]
    result: dict[str, Any] | None = None
