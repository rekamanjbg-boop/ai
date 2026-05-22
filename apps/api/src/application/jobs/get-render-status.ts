import type { QueueGateway } from "../../infrastructure/queue/queue-gateway.js";

export async function getRenderStatus(queueGateway: QueueGateway, jobId: string) {
  return queueGateway.getJobStatus(jobId);
}

