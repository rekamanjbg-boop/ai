import { Worker } from "bullmq";
import { createComfyUiClient } from "@media/comfyui-bridge/client";
import { getRedisConnectionOptions } from "@media/queue/redis";
import { QUEUES } from "@media/queue/queues";
import type { RuntimeConfig } from "@media/shared/config";
import { createLogger } from "@media/shared/logger";
import { createStorageAdapter } from "@media/storage/factory";
import { renderRemotionJob } from "../render/render-job.js";
import { syncNextcloudJob } from "../sync/sync-job.js";

export function createWorkers(config: RuntimeConfig) {
  const logger = createLogger("worker");
  const connection = getRedisConnectionOptions(config.redisUrl);
  const comfyui = createComfyUiClient(config.comfyUiBaseUrl, config.comfyUiTimeoutMs);
  const storage = createStorageAdapter(config);
  const role = config.workerRole;

  if (role === "all" || role === "generation") {
    new Worker(
      QUEUES.generation,
      async (job) => {
        logger.info("Running generation job", { jobId: job.id });
        await job.updateProgress({ stage: "generation", percent: 10 });
        const result = await comfyui.queueWorkflow(job.data);
        await job.updateProgress({ stage: "generation", percent: 100 });
        return result;
      },
      { connection, concurrency: config.generationConcurrency }
    );
  }

  if (role === "all" || role === "rendering" || role === "remotion") {
    new Worker(
      QUEUES.rendering,
      async (job) => {
        logger.info("Running rendering job", { jobId: job.id });
        return renderRemotionJob(job, config, storage);
      },
      { connection, concurrency: config.renderConcurrency }
    );
  }

  if (role === "all" || role === "delivery" || role === "sync") {
    new Worker(
      QUEUES.delivery,
      async (job) => {
        logger.info("Running sync job", { jobId: job.id });
        return syncNextcloudJob(job, config, storage);
      },
      { connection, concurrency: config.syncConcurrency }
    );
  }

  logger.info("Worker role registered", { role });
}
