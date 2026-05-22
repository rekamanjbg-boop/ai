import type { ComfyUiWorkflow } from "./workflow.js";

export type ComfyUiClientOptions = {
  baseUrl: string;
  timeoutMs: number;
  apiKey?: string;
};

export type ComfyUiPromptResponse = {
  prompt_id: string;
  number?: number;
  node_errors?: Record<string, unknown>;
};

export type ComfyUiImageOutput = {
  filename: string;
  subfolder?: string;
  type?: string;
};

export type ComfyUiHistoryResponse = Record<string, {
  status?: {
    completed?: boolean;
    status_str?: string;
  };
  outputs?: Record<string, {
    images?: ComfyUiImageOutput[];
  }>;
}>;

export function createComfyUiClient(baseUrl: string, timeoutMs: number, apiKey?: string) {
  const options = { baseUrl, timeoutMs, apiKey };

  return {
    async queueWorkflow(workflow: ComfyUiWorkflow) {
      return postPrompt(options, workflow);
    },
    async getHistory(promptId: string) {
      return getJson<ComfyUiHistoryResponse>(options, `/history/${encodeURIComponent(promptId)}`);
    },
    async downloadImage(image: ComfyUiImageOutput) {
      const params = new URLSearchParams({
        filename: image.filename,
        subfolder: image.subfolder ?? "",
        type: image.type ?? "output"
      });

      return getArrayBuffer(options, `/view?${params.toString()}`);
    }
  };
}

async function postPrompt(options: ComfyUiClientOptions, workflow: ComfyUiWorkflow) {
  return requestJson<ComfyUiPromptResponse>(options, "/prompt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: workflow })
  });
}

async function getJson<T>(options: ComfyUiClientOptions, path: string) {
  return requestJson<T>(options, path, { method: "GET" });
}

async function requestJson<T>(options: ComfyUiClientOptions, path: string, init: RequestInit) {
  const response = await request(options, path, init);
  return response.json() as Promise<T>;
}

async function getArrayBuffer(options: ComfyUiClientOptions, path: string) {
  const response = await request(options, path, { method: "GET" });
  return response.arrayBuffer();
}

async function request(options: ComfyUiClientOptions, path: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const headers = new Headers(init.headers);

    if (options.apiKey) {
      headers.set("authorization", `Bearer ${options.apiKey}`);
    }

    const response = await fetch(`${options.baseUrl}${path}`, {
      ...init,
      headers,
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ComfyUI request failed with ${response.status}: ${body}`);
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}
