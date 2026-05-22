import { z } from "zod";

export const createRenderJobSchema = z.object({
  projectId: z.string().min(1),
  prompt: z.string().min(1),
  format: z.enum(["short", "reel", "story", "landscape"]).default("reel"),
  assets: z.array(z.string().url()).default([]),
  metadata: z.record(z.unknown()).default({})
});

export type CreateRenderJobInput = z.infer<typeof createRenderJobSchema>;

export const createRemotionRenderSchema = z.object({
  projectId: z.string().min(1),
  compositionId: z.string().default("Main"),
  inputProps: z.record(z.unknown()).default({}),
  outputKey: z.string().optional(),
  codec: z.enum(["h264", "h265", "vp8", "vp9", "prores"]).default("h264"),
  imageFormat: z.enum(["jpeg", "png"]).default("jpeg"),
  ffmpegPreset: z.enum(["web", "archive"]).default("web")
});

export type CreateRemotionRenderInput = z.infer<typeof createRemotionRenderSchema>;

export const createSyncJobSchema = z.object({
  projectId: z.string().min(1),
  source: z.object({
    filePath: z.string().optional(),
    url: z.string().url().optional(),
    storageKey: z.string().optional()
  }).refine((source) => source.filePath || source.url || source.storageKey, {
    message: "source.filePath, source.url, or source.storageKey is required"
  }),
  fileName: z.string().optional(),
  folder: z.string().optional(),
  version: z.string().optional(),
  metadata: z.record(z.unknown()).default({})
});

export type CreateSyncJobInput = z.infer<typeof createSyncJobSchema>;

export const createAiVideoJobSchema = z.object({
  projectId: z.string().min(1),
  orchestrationId: z.string().optional(),
  stage: z.string().optional(),
  prompt: z.string().min(1),
  input: z.record(z.unknown()).default({}),
  model: z.object({
    owner: z.string().optional(),
    name: z.string().optional(),
    version: z.string().optional()
  }).optional(),
  deployment: z.object({
    owner: z.string().optional(),
    name: z.string().optional()
  }).optional(),
  outputKey: z.string().optional(),
  outputPrefix: z.string().default("videos/replicate"),
  metadata: z.record(z.unknown()).default({})
});

export type CreateAiVideoJobInput = z.infer<typeof createAiVideoJobSchema>;

export type RenderJobStatus = {
  jobId: string;
  queue: string;
  state: string;
  progress: unknown;
  attemptsMade: number;
  failedReason?: string;
  createdAt?: string;
  processedAt?: string;
  finishedAt?: string;
  result?: unknown;
};
