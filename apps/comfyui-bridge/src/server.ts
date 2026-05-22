import { createServer } from "node:http";
import { Worker } from "bullmq";
import { QUEUES } from "@media/queue/queues";
import { getRedisConnectionOptions } from "@media/queue/redis";
import { loadConfig } from "@media/shared/config";
import { createLogger } from "@media/shared/logger";
import { createStorageAdapter } from "@media/storage/factory";
import { createApp } from "./http/app.js";
import { createImageQueue } from "./infrastructure/queue.js";
import { processComfyUiJob } from "./application/process-comfyui-job.js";

const config = loadConfig();
const logger = createLogger("comfyui-bridge");
const mode = process.env.COMFYUI_BRIDGE_MODE ?? "all";
const imageQueue = createImageQueue(config.redisUrl);
const connection = getRedisConnectionOptions(config.redisUrl);
const resources: Array<{ close(): Promise<unknown> }> = [imageQueue];

let server: ReturnType<typeof createServer> | undefined;

if (mode === "api" || mode === "all") {
  const app = createApp({ config, imageQueue });
  server = createServer(app);

  server.listen(3100, "0.0.0.0", () => {
    logger.info("ComfyUI bridge API listening", { port: 3100, mode });
  });
}

if (mode === "worker" || mode === "all") {
  const storage = createStorageAdapter(config);
  const worker = new Worker(
    QUEUES.imageGeneration,
    (job) => processComfyUiJob(job, config, storage),
    {
      connection,
      concurrency: config.generationConcurrency
    }
  );

  worker.on("failed", (job, error) => {
    logger.error("Image generation job failed", { jobId: job?.id, error });
  });

  resources.push(worker);
  logger.info("ComfyUI generation worker started", { mode });
}

if (!["api", "worker", "all"].includes(mode)) {
  throw new Error(`Invalid COMFYUI_BRIDGE_MODE: ${mode}`);
}

async function shutdown(signal: string) {
  logger.info("Shutting down ComfyUI bridge", { signal });

  const closeResources = async () => {
    await Promise.all(resources.map((resource) => resource.close()));
    process.exit(0);
  };

  if (server) {
    server.close(() => void closeResources());
    return;
  }

  await closeResources();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
