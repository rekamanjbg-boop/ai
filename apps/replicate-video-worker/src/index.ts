import { Worker } from "bullmq";
import { QUEUES } from "@media/queue/queues";
import { getRedisConnectionOptions } from "@media/queue/redis";
import { loadConfig } from "@media/shared/config";
import { createLogger } from "@media/shared/logger";
import { createStorageAdapter } from "@media/storage/factory";
import { processVideoJob } from "./application/process-video-job.js";

const config = loadConfig();
const logger = createLogger("ai-video-worker");
const connection = getRedisConnectionOptions(config.redisUrl);
const storage = createStorageAdapter(config);

const worker = new Worker(
  QUEUES.videoGeneration,
  (job) => processVideoJob(job, config, storage),
  {
    connection,
    concurrency: config.videoGenerationConcurrency
  }
);

worker.on("ready", () => {
  logger.info("AI video worker ready", { concurrency: config.videoGenerationConcurrency });
});

worker.on("failed", (job, error) => {
  logger.error("AI video generation failed", { jobId: job?.id, error });
});

async function shutdown(signal: string) {
  logger.info("Shutting down AI video worker", { signal });
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

