import type { Job } from "bullmq";
import { QueueEvents } from "bullmq";
import { createQueueClient, type QueueClient } from "@media/queue/client";
import { getRedisConnectionOptions } from "@media/queue/redis";
import { QUEUES } from "@media/queue/queues";
import type {
  CreateAiVideoJobInput,
  CreateRemotionRenderInput,
  CreateRenderJobInput,
  CreateSyncJobInput,
  RenderJobStatus
} from "../../domain/jobs/job.schema.js";

type QueueName = keyof QueueClient;

export type QueueGateway = ReturnType<typeof createQueueGateway>;

const QUEUE_ORDER: QueueName[] = ["production", "imageGeneration", "videoGeneration", "generation", "rendering", "delivery"];

export function createQueueGateway(redisUrl: string) {
  const queues = createQueueClient(redisUrl);
  const connection = getRedisConnectionOptions(redisUrl);
  const events = {
    production: new QueueEvents(QUEUES.production, { connection }),
    imageGeneration: new QueueEvents(QUEUES.imageGeneration, { connection }),
    videoGeneration: new QueueEvents(QUEUES.videoGeneration, { connection }),
    generation: new QueueEvents(QUEUES.generation, { connection }),
    rendering: new QueueEvents(QUEUES.rendering, { connection }),
    delivery: new QueueEvents(QUEUES.delivery, { connection })
  };

  return {
    events,
    async createProductionJob(input: CreateRenderJobInput) {
      return queues.production.add("plan-production", input, {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 60 * 60 * 24, count: 1000 },
        removeOnFail: { age: 60 * 60 * 24 * 7 }
      });
    },
    async createRenderJob(input: CreateRemotionRenderInput) {
      return queues.rendering.add("render-remotion", input, {
        attempts: 2,
        backoff: { type: "exponential", delay: 10000 },
        removeOnComplete: { age: 60 * 60 * 24, count: 500 },
        removeOnFail: { age: 60 * 60 * 24 * 7 }
      });
    },
    async createSyncJob(input: CreateSyncJobInput) {
      return queues.delivery.add("sync-nextcloud", input, {
        attempts: 3,
        backoff: { type: "exponential", delay: 10000 },
        removeOnComplete: { age: 60 * 60 * 24, count: 1000 },
        removeOnFail: { age: 60 * 60 * 24 * 7 }
      });
    },
    async createAiVideoJob(input: CreateAiVideoJobInput) {
      return queues.videoGeneration.add("replicate-video-generation", input, {
        attempts: 3,
        backoff: { type: "exponential", delay: 15000 },
        removeOnComplete: { age: 60 * 60 * 24, count: 1000 },
        removeOnFail: { age: 60 * 60 * 24 * 7 }
      });
    },
    async getJobStatus(jobId: string): Promise<RenderJobStatus | null> {
      for (const queueName of QUEUE_ORDER) {
        const job = await queues[queueName].getJob(jobId);

        if (job) {
          return serializeJobStatus(queueName, job);
        }
      }

      return null;
    },
    async close() {
      await Promise.all([
        ...Object.values(queues).map((queue) => queue.close()),
        ...Object.values(events).map((queueEvents) => queueEvents.close())
      ]);
    }
  };
}

async function serializeJobStatus(queueName: QueueName, job: Job): Promise<RenderJobStatus> {
  const state = await job.getState();

  return {
    jobId: String(job.id),
    queue: queueName,
    state,
    progress: job.progress,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason,
    createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : undefined,
    processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : undefined,
    finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined,
    result: job.returnvalue
  };
}
