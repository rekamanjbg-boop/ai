import { mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import type { Job } from "bullmq";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { RuntimeConfig } from "@media/shared/config";
import type { StorageAdapter } from "@media/storage/adapter";
import { createLogger } from "@media/shared/logger";

type RenderJobData = {
  projectId?: string;
  compositionId?: string;
  inputProps?: Record<string, unknown>;
  outputKey?: string;
  codec?: "h264" | "h265" | "vp8" | "vp9" | "prores";
  imageFormat?: "jpeg" | "png";
  ffmpegPreset?: "web" | "archive";
};

type RenderJobResult = {
  renderId: string;
  storageKey: string;
  signedUrl: string;
  outputPath: string;
  status: "rendered";
};

const logger = createLogger("remotion-worker");
const workerRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(workerRoot, "../../../..");
const remotionEntry = resolve(repoRoot, "apps/remotion/src/index.ts");

export async function renderRemotionJob(
  job: Job<RenderJobData>,
  config: RuntimeConfig,
  storage: StorageAdapter
): Promise<RenderJobResult> {
  const data = job.data ?? {};
  const renderId = String(job.id);
  const projectId = data.projectId ?? "default";
  const compositionId = data.compositionId ?? "Main";
  const outputKey = data.outputKey ?? `renders/${projectId}/${renderId}.mp4`;
  const workDir = join("/tmp/remotion", renderId);
  const rawOutput = join(workDir, "raw.mp4");
  const finalOutput = join(workDir, "final.mp4");

  await mkdir(workDir, { recursive: true });

  try {
    await report(job, "bundling", 5);
    const serveUrl = await bundle({
      entryPoint: remotionEntry,
      webpackOverride: (config) => config
    });

    await report(job, "selecting-composition", 10);
    const composition = await selectComposition({
      serveUrl,
      id: compositionId,
      inputProps: data.inputProps ?? {}
    });

    await report(job, "rendering", 15);
    await renderMedia({
      composition,
      serveUrl,
      codec: data.codec ?? "h264",
      imageFormat: data.imageFormat ?? "jpeg",
      inputProps: data.inputProps ?? {},
      outputLocation: rawOutput,
      onProgress: ({ progress }) => {
        void report(job, "rendering", 15 + Math.round(progress * 65));
      }
    });

    await report(job, "post-processing", 82);
    await runFfmpeg(rawOutput, finalOutput, data.ffmpegPreset ?? "web");

    await report(job, "uploading", 92);
    await storage.putFile(outputKey, finalOutput, "video/mp4");
    const signedUrl = await storage.getSignedUrl(outputKey);

    await report(job, "completed", 100, { storageKey: outputKey, signedUrl });

    return {
      renderId,
      storageKey: outputKey,
      signedUrl,
      outputPath: finalOutput,
      status: "rendered"
    };
  } catch (error) {
    logger.error("Remotion render failed", { jobId: renderId, error });
    await report(job, "failed", 100, { message: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally {
    if (config.nodeEnv === "production") {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}

async function report(job: Job, stage: string, percent: number, data: Record<string, unknown> = {}) {
  await job.updateProgress({
    stage,
    percent,
    ...data,
    updatedAt: new Date().toISOString()
  });
}

async function runFfmpeg(input: string, output: string, preset: "web" | "archive") {
  await mkdir(dirname(output), { recursive: true });

  const args = preset === "archive"
    ? ["-y", "-i", input, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-c:a", "aac", "-b:a", "192k", output]
    : ["-y", "-i", input, "-movflags", "+faststart", "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-c:a", "aac", "-b:a", "160k", output];

  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
    });
  });
}
