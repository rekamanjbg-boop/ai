import type { RuntimeConfig } from "@media/shared/config";
import type { ReplicateVideoTask } from "../domain/video-task.js";

export type ReplicatePrediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: unknown;
  error?: unknown;
  logs?: string;
  metrics?: Record<string, unknown>;
  urls?: {
    get?: string;
    cancel?: string;
    web?: string;
  };
};

export function createReplicateClient(config: RuntimeConfig) {
  const token = config.replicate.apiToken;

  if (!token) {
    throw new Error("REPLICATE_API_TOKEN is required for ai-video-worker");
  }

  return {
    async createPrediction(task: ReplicateVideoTask) {
      const endpoint = resolveEndpoint(config, task);
      const body = resolveBody(config, task);

      return request<ReplicatePrediction>(token, endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cancel-after": config.replicate.cancelAfter
        },
        body: JSON.stringify(body)
      });
    },
    async getPrediction(predictionId: string) {
      return request<ReplicatePrediction>(
        token,
        `https://api.replicate.com/v1/predictions/${encodeURIComponent(predictionId)}`,
        { method: "GET" }
      );
    },
    async downloadOutput(url: string) {
      const response = await fetch(url, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      if (!response.ok || !response.body) {
        throw new Error(`Replicate output download failed with ${response.status}`);
      }

      return {
        stream: response.body,
        contentType: response.headers.get("content-type") ?? "video/mp4"
      };
    }
  };
}

async function request<T>(token: string, url: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);

  const response = await fetch(url, {
    ...init,
    headers
  });

  if (!response.ok) {
    throw new Error(`Replicate request failed with ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<T>;
}

function resolveEndpoint(config: RuntimeConfig, task: ReplicateVideoTask) {
  const deploymentOwner = task.deployment?.owner ?? config.replicate.deploymentOwner;
  const deploymentName = task.deployment?.name ?? config.replicate.deploymentName;

  if (deploymentOwner && deploymentName) {
    return `https://api.replicate.com/v1/deployments/${deploymentOwner}/${deploymentName}/predictions`;
  }

  const modelOwner = task.model?.owner ?? config.replicate.modelOwner;
  const modelName = task.model?.name ?? config.replicate.modelName;

  if (modelOwner && modelName) {
    return `https://api.replicate.com/v1/models/${modelOwner}/${modelName}/predictions`;
  }

  return "https://api.replicate.com/v1/predictions";
}

function resolveBody(config: RuntimeConfig, task: ReplicateVideoTask) {
  const input: Record<string, unknown> = {
    ...task.input,
    prompt: task.input.prompt ?? task.prompt
  };

  const modelOwner = task.model?.owner ?? config.replicate.modelOwner;
  const modelName = task.model?.name ?? config.replicate.modelName;

  if (
    config.openaiApiKey &&
    modelOwner === "openai" &&
    modelName?.startsWith("sora-") &&
    !input.openai_api_key
  ) {
    input.openai_api_key = config.openaiApiKey;
  }

  const version = task.model?.version ?? config.replicate.modelVersion;

  if (version && !task.deployment?.owner && !config.replicate.deploymentOwner && !task.model?.owner && !config.replicate.modelOwner) {
    return { version, input };
  }

  return { input };
}
