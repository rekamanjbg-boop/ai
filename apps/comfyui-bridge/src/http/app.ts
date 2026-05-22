import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { RuntimeConfig } from "@media/shared/config";
import type { ImageQueue } from "../infrastructure/queue.js";
import { enqueueImageGeneration, enqueueWorkflowGeneration } from "../application/enqueue.js";
import { getGenerationStatus } from "../application/status.js";
import { imageGenerationSchema, workflowGenerationSchema } from "../domain/schemas.js";

type AppDependencies = {
  config: RuntimeConfig;
  imageQueue: ImageQueue;
};

export function createApp({ config, imageQueue }: AppDependencies) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: config.bodyLimit }));

  app.get("/health", (_request, response) => {
    response.json({
      ok: true,
      service: "comfyui-bridge",
      time: new Date().toISOString()
    });
  });

  app.post("/v1/images", async (request, response, next) => {
    try {
      const input = imageGenerationSchema.parse(request.body);
      const job = await enqueueImageGeneration(imageQueue, input);

      response.status(202).json({
        jobId: String(job.id),
        status: "queued",
        links: {
          status: `/v1/images/${job.id}/status`,
          websocket: `/v1/ws/progress?jobId=${job.id}`
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/workflows", async (request, response, next) => {
    try {
      const input = workflowGenerationSchema.parse(request.body);
      const job = await enqueueWorkflowGeneration(imageQueue, input);

      response.status(202).json({
        jobId: String(job.id),
        status: "queued",
        links: {
          status: `/v1/images/${job.id}/status`,
          websocket: `/v1/ws/progress?jobId=${job.id}`
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/images/:jobId/status", async (request, response, next) => {
    try {
      const status = await getGenerationStatus(imageQueue, request.params.jobId);

      if (!status) {
        return response.status(404).json({
          error: {
            code: "JOB_NOT_FOUND",
            message: "Image generation job was not found"
          }
        });
      }

      return response.json(status);
    } catch (error) {
      return next(error);
    }
  });

  app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    response.status(400).json({
      error: {
        code: "REQUEST_ERROR",
        message: error.message
      }
    });
  });

  return app;
}

