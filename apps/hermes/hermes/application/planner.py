from hermes.domain.models import CreateOrchestrationRequest, OrchestrationPlan, OrchestrationStage


def create_plan(request: CreateOrchestrationRequest) -> OrchestrationPlan:
    return OrchestrationPlan(
        project_id=request.project_id,
        prompt=request.prompt,
        format=request.format,
        assets=request.assets,
        metadata=request.metadata,
        stages=[
            OrchestrationStage(
                name="generate-visual-assets",
                worker="comfyui",
                payload={
                    "prompt": request.prompt,
                    "format": request.format,
                    "assets": request.assets,
                },
            ),
            OrchestrationStage(
                name="render-video",
                worker="remotion",
                payload={
                    "format": request.format,
                    "projectId": request.project_id,
                },
            ),
            OrchestrationStage(
                name="publish-artifacts",
                worker="delivery",
                payload={
                    "projectId": request.project_id,
                },
            ),
        ],
    )

