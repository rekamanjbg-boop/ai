import type { CreateRenderJobInput } from "../../domain/jobs/job.schema.js";
import type { QueueGateway } from "../../infrastructure/queue/queue-gateway.js";

export async function createRenderJob(queueGateway: QueueGateway, input: CreateRenderJobInput) {
  const job = await queueGateway.createProductionJob(input);

  return {
    jobId: String(job.id),
    status: "queued",
    links: {
      status: `/v1/renders/${job.id}/status`,
      websocket: `/v1/ws/progress?jobId=${job.id}`
    }
  };
}

