import { z } from "zod";

export const imageGenerationSchema = z.object({
  projectId: z.string().min(1),
  prompt: z.string().min(1),
  workflow: z.record(z.unknown()).optional(),
  width: z.number().int().positive().default(1024),
  height: z.number().int().positive().default(1024),
  seed: z.number().int().optional(),
  outputPrefix: z.string().default("comfyui/images"),
  metadata: z.record(z.unknown()).default({})
});

export const workflowGenerationSchema = z.object({
  projectId: z.string().min(1),
  workflow: z.record(z.unknown()),
  outputPrefix: z.string().default("comfyui/workflows"),
  metadata: z.record(z.unknown()).default({})
});

export type ImageGenerationInput = z.infer<typeof imageGenerationSchema>;
export type WorkflowGenerationInput = z.infer<typeof workflowGenerationSchema>;

export type ComfyUiQueuePayload = {
  projectId: string;
  workflow: Record<string, unknown>;
  outputPrefix: string;
  metadata: Record<string, unknown>;
};

