import type { ImageQueue } from "../infrastructure/queue.js";

export async function getGenerationStatus(queue: ImageQueue, jobId: string) {
  const job = await queue.queue.getJob(jobId);

  if (!job) {
    return null;
  }

  return {
    jobId: String(job.id),
    queue: "imageGeneration",
    state: await job.getState(),
    progress: job.progress,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason,
    createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : undefined,
    processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : undefined,
    finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined,
    result: job.returnvalue
  };
}

