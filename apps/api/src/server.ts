import { createServer } from "node:http";
import { createApp } from "./app.js";
import { createProgressWebSocketServer } from "./websocket/progress-server.js";
import { createQueueGateway } from "./infrastructure/queue/queue-gateway.js";
import { loadConfig } from "@media/shared/config";
import { createLogger } from "@media/shared/logger";

const config = loadConfig();
const logger = createLogger("api");
const queueGateway = createQueueGateway(config.redisUrl);
const app = createApp({ config, queueGateway });
const server = createServer(app);

createProgressWebSocketServer({
  server,
  queueGateway,
  logger
});

server.listen(config.port, "0.0.0.0", () => {
  logger.info("API listening", {
    port: config.port,
    nodeEnv: config.nodeEnv
  });
});

async function shutdown(signal: string) {
  logger.info("Shutting down API", { signal });

  server.close(async () => {
    await queueGateway.close();
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

