import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { RuntimeConfig } from "@media/shared/config";
import { createHealthRouter } from "./http/routes/health.routes.js";
import { createJobsRouter } from "./http/routes/jobs.routes.js";
import { createRenderRouter } from "./http/routes/render.routes.js";
import { createSyncRouter } from "./http/routes/sync.routes.js";
import { createVideoRouter } from "./http/routes/video.routes.js";
import { errorMiddleware } from "./http/middleware/error-middleware.js";
import { requestContextMiddleware } from "./http/middleware/request-context.js";
import type { QueueGateway } from "./infrastructure/queue/queue-gateway.js";

type AppDependencies = {
  config: RuntimeConfig;
  queueGateway: QueueGateway;
};

export function createApp({ config, queueGateway }: AppDependencies) {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: config.bodyLimit }));
  app.use(requestContextMiddleware);

  app.use("/health", createHealthRouter());
  app.use("/v1/jobs", createJobsRouter(queueGateway));
  app.use("/v1/renders", createRenderRouter(queueGateway));
  app.use("/v1/sync", createSyncRouter(queueGateway));
  app.use("/v1/videos", createVideoRouter(queueGateway));

  app.use(errorMiddleware);

  return app;
}
