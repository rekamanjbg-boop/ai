import type { Server as HttpServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import type { createLogger } from "@media/shared/logger";
import type { QueueGateway } from "../infrastructure/queue/queue-gateway.js";

type ProgressServerDependencies = {
  server: HttpServer;
  queueGateway: QueueGateway;
  logger: ReturnType<typeof createLogger>;
};

type ProgressMessage = {
  type: "connected" | "progress" | "completed" | "failed";
  jobId?: string;
  queue?: string;
  data?: unknown;
};

export function createProgressWebSocketServer({
  server,
  queueGateway,
  logger
}: ProgressServerDependencies) {
  const clients = new Map<string, Set<WebSocket>>();
  const webSocketServer = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", "http://localhost");

    if (url.pathname !== "/v1/ws/progress") {
      socket.destroy();
      return;
    }

    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      const jobId = url.searchParams.get("jobId");

      if (!jobId) {
        webSocket.close(1008, "jobId is required");
        return;
      }

      subscribe(clients, webSocket, jobId);
    });
  });

  for (const [queue, queueEvents] of Object.entries(queueGateway.events)) {
    queueEvents.on("progress", ({ jobId, data }) => {
      broadcast(clients, jobId, { type: "progress", queue, jobId, data });
    });

    queueEvents.on("completed", ({ jobId, returnvalue }) => {
      broadcast(clients, jobId, { type: "completed", queue, jobId, data: returnvalue });
    });

    queueEvents.on("failed", ({ jobId, failedReason }) => {
      broadcast(clients, jobId, { type: "failed", queue, jobId, data: { failedReason } });
    });

    queueEvents.on("error", (error) => {
      logger.error("Queue event stream failed", { queue, error });
    });
  }

  return webSocketServer;
}

function subscribe(clients: Map<string, Set<WebSocket>>, webSocket: WebSocket, jobId: string) {
  const subscriptions = clients.get(jobId) ?? new Set<WebSocket>();
  subscriptions.add(webSocket);
  clients.set(jobId, subscriptions);

  send(webSocket, { type: "connected", jobId });

  webSocket.on("close", () => {
    subscriptions.delete(webSocket);

    if (subscriptions.size === 0) {
      clients.delete(jobId);
    }
  });
}

function broadcast(clients: Map<string, Set<WebSocket>>, jobId: string, message: ProgressMessage) {
  const subscriptions = clients.get(jobId);

  if (!subscriptions) {
    return;
  }

  for (const client of subscriptions) {
    send(client, message);
  }
}

function send(client: WebSocket, message: ProgressMessage) {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(message));
  }
}
