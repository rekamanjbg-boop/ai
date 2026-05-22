import { z } from "zod";

export const replicateVideoTaskSchema = z.object({
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

export type ReplicateVideoTask = z.infer<typeof replicateVideoTaskSchema>;

