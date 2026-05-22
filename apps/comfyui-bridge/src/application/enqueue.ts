import { buildImageWorkflow } from "@media/comfyui-bridge/workflow";
import type { ImageQueue } from "../infrastructure/queue.js";
import type {
  ComfyUiQueuePayload,
  ImageGenerationInput,
  WorkflowGenerationInput
} from "../domain/schemas.js";

export async function enqueueImageGeneration(queue: ImageQueue, input: ImageGenerationInput) {
  const workflow = input.workflow ?? buildImageWorkflow({
    prompt: input.prompt,
    width: input.width,
    height: input.height,
    seed: input.seed
  });

  return queue.queue.add("comfyui-image-generation", {
    projectId: input.projectId,
    workflow,
    outputPrefix: input.outputPrefix,
    metadata: {
      ...input.metadata,
      prompt: input.prompt,
      width: input.width,
      height: input.height,
      seed: input.seed
    }
  } satisfies ComfyUiQueuePayload, retryOptions());
}

export async function enqueueWorkflowGeneration(queue: ImageQueue, input: WorkflowGenerationInput) {
  return queue.queue.add("comfyui-workflow-generation", {
    projectId: input.projectId,
    workflow: input.workflow,
    outputPrefix: input.outputPrefix,
    metadata: input.metadata
  } satisfies ComfyUiQueuePayload, retryOptions());
}

function retryOptions() {
  return {
    attempts: 3,
    backoff: { type: "exponential", delay: 10000 },
    removeOnComplete: { age: 60 * 60 * 24, count: 1000 },
    removeOnFail: { age: 60 * 60 * 24 * 7 }
  };
}

