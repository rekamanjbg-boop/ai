import type { Job } from "bullmq";
import type { RuntimeConfig } from "@media/shared/config";
import { createLogger } from "@media/shared/logger";
import type { StorageAdapter } from "@media/storage/adapter";
import { createReplicateClient, type ReplicatePrediction } from "../infrastructure/replicate-client.js";
import { nodeReadableFromWeb } from "../infrastructure/web-stream.js";
import { replicateVideoTaskSchema, type ReplicateVideoTask } from "../domain/video-task.js";
import { findVideoOutputUrl } from "./video-output.js";

const logger = createLogger("ai-video-worker");

export async function processVideoJob(
  job: Job<ReplicateVideoTask>,
  config: RuntimeConfig,
  storage: StorageAdapter
) {
  const task = replicateVideoTaskSchema.parse(job.data);
  const client = createReplicateClient(config);

  await report(job, "submitting", 5);
  const created = await client.createPrediction(task);

  await report(job, "queued", 10, {
    predictionId: created.id,
    replicateStatus: created.status,
    orchestrationId: task.orchestrationId,
    stage: task.stage
  });

  const prediction = await pollPrediction(job, client, created.id, config);
  const outputUrl = findVideoOutputUrl(prediction.output);
  const outputKey = task.outputKey ?? `${task.outputPrefix}/${task.projectId}/${created.id}.mp4`;

  await report(job, "downloading", 85, { predictionId: created.id, outputUrl });
  const download = await client.downloadOutput(outputUrl);

  await report(job, "uploading", 92, { outputKey });
  const uploaded = await storage.putStream(
    outputKey,
    nodeReadableFromWeb(download.stream),
    {
      contentType: normalizeVideoContentType(download.contentType),
      metadata: {
        projectid: task.projectId,
        predictionid: created.id,
        orchestrationid: task.orchestrationId ?? "",
        stage: task.stage ?? "",
        source: "replicate"
      }
    }
  );

  await report(job, "completed", 100, {
    predictionId: created.id,
    storageKey: uploaded.key,
    signedUrl: uploaded.signedUrl
  });

  logger.info("AI video generation completed", {
    jobId: job.id,
    predictionId: created.id,
    storageKey: uploaded.key
  });

  return {
    status: "completed",
    predictionId: created.id,
    storageKey: uploaded.key,
    signedUrl: uploaded.signedUrl,
    replicate: {
      status: prediction.status,
      metrics: prediction.metrics,
      webUrl: prediction.urls?.web
    }
  };
}

async function pollPrediction(
  job: Job,
  client: ReturnType<typeof createReplicateClient>,
  predictionId: string,
  config: RuntimeConfig
): Promise<ReplicatePrediction> {
  for (let attempt = 1; attempt <= config.replicate.maxPollAttempts; attempt += 1) {
    const prediction = await client.getPrediction(predictionId);
    const percent = Math.min(80, 10 + Math.round((attempt / config.replicate.maxPollAttempts) * 70));

    await report(job, "polling", percent, {
      predictionId,
      replicateStatus: prediction.status,
      attempt,
      logs: tail(prediction.logs ?? "", 2000)
    });

    if (prediction.status === "succeeded") {
      return prediction;
    }

    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new Error(`Replicate prediction ${prediction.status}: ${JSON.stringify(prediction.error)}`);
    }

    await sleep(config.replicate.pollIntervalMs);
  }

  throw new Error(`Replicate polling timed out for prediction ${predictionId}`);
}

async function report(job: Job, stage: string, percent: number, data: Record<string, unknown> = {}) {
  await job.updateProgress({
    stage,
    percent,
    ...data,
    updatedAt: new Date().toISOString()
  });
}

function normalizeVideoContentType(contentType: string) {
  return contentType.includes("video/") ? contentType : "video/mp4";
}

function tail(value: string, maxLength: number) {
  return value.length <= maxLength ? value : value.slice(value.length - maxLength);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
