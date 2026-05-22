import { basename, extname, join } from "node:path";
import type { Job } from "bullmq";
import type { RuntimeConfig } from "@media/shared/config";
import { createLogger } from "@media/shared/logger";
import type { StorageAdapter } from "@media/storage/adapter";
import { createNextcloudClient } from "./nextcloud-client.js";
import { nodeReadableFromWeb } from "./web-stream.js";

type SyncJobData = {
  projectId: string;
  source: {
    filePath?: string;
    url?: string;
    storageKey?: string;
  };
  fileName?: string;
  folder?: string;
  version?: string;
  metadata?: Record<string, unknown>;
};

type SyncJobResult = {
  status: "synced";
  remotePath: string;
  version: string;
};

const logger = createLogger("sync-worker");

export async function syncNextcloudJob(
  job: Job<SyncJobData>,
  config: RuntimeConfig,
  storage: StorageAdapter
): Promise<SyncJobResult> {
  const nextcloud = createNextcloudClient(config);
  const version = job.data.version ?? versionStamp();
  const fileName = resolveFileName(job.data);
  const folder = cleanPath(job.data.folder ?? job.data.projectId);
  const remoteFolder = cleanPath(join(config.nextcloud.rootFolder, folder, version));
  const remotePath = cleanPath(join(remoteFolder, fileName));

  await report(job, "preparing-folder", 10, { remoteFolder });
  await retry(config.nextcloud.uploadRetries, () => nextcloud.ensureFolder(remoteFolder));

  await report(job, "uploading", 35, { remotePath });

  if (job.data.source.filePath) {
    await retry(config.nextcloud.uploadRetries, () => nextcloud.uploadFile(
      remotePath,
      job.data.source.filePath as string,
      contentTypeFromName(fileName)
    ));
  } else {
    const url = job.data.source.url ?? await storage.getSignedUrl(job.data.source.storageKey as string);
    const response = await fetch(url);

    if (!response.ok || !response.body) {
      throw new Error(`Failed to fetch sync source: ${response.status}`);
    }

    const responseBody = response.body;

    await retry(config.nextcloud.uploadRetries, () => nextcloud.upload({
      remotePath,
      body: nodeReadableFromWeb(responseBody),
      contentType: response.headers.get("content-type") ?? contentTypeFromName(fileName)
    }));
  }

  await report(job, "completed", 100, { remotePath, version });
  logger.info("Nextcloud sync completed", { jobId: job.id, remotePath });

  return {
    status: "synced",
    remotePath,
    version
  };
}

function resolveFileName(data: SyncJobData) {
  if (data.fileName) {
    return data.fileName;
  }

  if (data.source.filePath) {
    return basename(data.source.filePath);
  }

  if (data.source.storageKey) {
    return basename(data.source.storageKey);
  }

  const url = new URL(data.source.url as string);
  return basename(url.pathname) || "render-output.mp4";
}

async function report(job: Job, stage: string, percent: number, data: Record<string, unknown> = {}) {
  await job.updateProgress({
    stage,
    percent,
    ...data,
    updatedAt: new Date().toISOString()
  });
}

async function retry<T>(attempts: number, operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  const maxAttempts = Math.max(1, attempts);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts) {
        await sleep(Math.min(30000, 1000 * 2 ** (attempt - 1)));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function versionStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function cleanPath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function contentTypeFromName(fileName: string) {
  const extension = extname(fileName).toLowerCase();

  if (extension === ".mp4") {
    return "video/mp4";
  }

  if (extension === ".mov") {
    return "video/quicktime";
  }

  if (extension === ".png") {
    return "image/png";
  }

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  return "application/octet-stream";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
