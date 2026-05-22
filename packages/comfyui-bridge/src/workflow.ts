export type ComfyUiWorkflow = Record<string, unknown>;

export type WorkflowTemplateInput = {
  prompt: string;
  width: number;
  height: number;
  seed?: number;
};

export function buildImageWorkflow(input: WorkflowTemplateInput): ComfyUiWorkflow {
  return {
    meta: {
      kind: "image-generation",
      prompt: input.prompt,
      width: input.width,
      height: input.height,
      seed: input.seed ?? -1
    }
  };
}

