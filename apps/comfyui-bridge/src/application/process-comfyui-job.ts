import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type { Job } from "bullmq";
import { createComfyUiClient, type ComfyUiImageOutput } from "@media/comfyui-bridge/client";
import type { RuntimeConfig } from "@media/shared/config";
import { createLogger } from "@media/shared/logger";
import type { StorageAdapter } from "@media/storage/adapter";
import type { ComfyUiQueuePayload } from "../domain/schemas.js";

type UploadedImage = {
  storageKey: string;
  signedUrl: string;
  source: ComfyUiImageOutput;
};

const logger = createLogger("comfyui-bridge");

export async function processComfyUiJob(
  job: Job<ComfyUiQueuePayload>,
  config: RuntimeConfig,
  storage: StorageAdapter
) {
  const client = createComfyUiClient(
    config.comfyUiBaseUrl,
    config.comfyUiTimeoutMs,
    config.comfyUiApiKey
  );
  const tempDir = join("/tmp/comfyui", String(job.id));

  await mkdir(tempDir, { recursive: true });

  try {
    await report(job, "submitting", 5);
    const queued = await client.queueWorkflow(job.data.workflow);
    const promptId = queued.prompt_id;

    if (!promptId) {
      throw new Error("ComfyUI did not return prompt_id");
    }

    await report(job, "queued", 10, { promptId });
    const outputs = await pollForOutputs(job, client, promptId, config);
    const uploaded: UploadedImage[] = [];

    for (const [index, output] of outputs.entries()) {
      await report(job, "downloading", 80 + index, { promptId, filename: output.filename });
      const bytes = Buffer.from(await client.downloadImage(output));
      const extension = extensionFromFilename(output.filename);
      const localPath = join(tempDir, `${index}.${extension}`);
      const storageKey = `${job.data.outputPrefix}/${job.data.projectId}/${promptId}-${index}.${extension}`;

      await writeFile(localPath, bytes);
      await report(job, "uploading", 90 + index, { storageKey });
      await storage.putFile(storageKey, localPath, contentTypeForExtension(extension));

      uploaded.push({
        storageKey,
        signedUrl: await storage.getSignedUrl(storageKey),
        source: output
      });
    }

    await report(job, "completed", 100, { promptId, outputs: uploaded });

    return {
      promptId,
      outputs: uploaded,
      status: "completed"
    };
  } catch (error) {
    logger.error("ComfyUI generation failed", { jobId: job.id, error });
    await report(job, "failed", 100, { message: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally {
    if (config.nodeEnv === "production") {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

async function pollForOutputs(
  job: Job,
  client: ReturnType<typeof createComfyUiClient>,
  promptId: string,
  config: RuntimeConfig
) {
  for (let attempt = 1; attempt <= config.comfyUiMaxPollAttempts; attempt += 1) {
    const history = await client.getHistory(promptId);
    const item = history[promptId];
    const percent = Math.min(75, 10 + Math.round((attempt / config.comfyUiMaxPollAttempts) * 65));

    await report(job, "polling", percent, { promptId, attempt });

    if (item?.status?.completed) {
      const outputs = Object.values(item.outputs ?? {}).flatMap((output) => output.images ?? []);

      if (outputs.length === 0) {
        throw new Error("ComfyUI completed without image outputs");
      }

      return outputs;
    }

    await sleep(config.comfyUiPollIntervalMs);
  }

  throw new Error(`ComfyUI polling timed out for prompt ${promptId}`);
}

async function report(job: Job, stage: string, percent: number, data: Record<string, unknown> = {}) {
  await job.updateProgress({
    stage,
    percent,
    ...data,
    updatedAt: new Date().toISOString()
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extensionFromFilename(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension && extension.length <= 5 ? extension : "png";
}

function contentTypeForExtension(extension: string) {
  if (extension === "jpg" || extension === "jpeg") {
    return "image/jpeg";
  }

  if (extension === "webp") {
    return "image/webp";
  }

  return "image/png";
}

