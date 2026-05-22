import { Router } from "express";
import { z } from "zod";
import { getRenderStatus } from "../../application/jobs/get-render-status.js";
import { createRemotionRenderSchema } from "../../domain/jobs/job.schema.js";
import { asyncHandler } from "../middleware/async-handler.js";
import type { QueueGateway } from "../../infrastructure/queue/queue-gateway.js";

const paramsSchema = z.object({
  jobId: z.string().min(1)
});

export function createRenderRouter(queueGateway: QueueGateway) {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (request, response) => {
      const input = createRemotionRenderSchema.parse(request.body);
      const job = await queueGateway.createRenderJob(input);

      return response.status(202).json({
        jobId: String(job.id),
        status: "queued",
        links: {
          status: `/v1/renders/${job.id}/status`,
          websocket: `/v1/ws/progress?jobId=${job.id}`
        }
      });
    })
  );

  router.get(
    "/:jobId/status",
    asyncHandler(async (request, response) => {
      const { jobId } = paramsSchema.parse(request.params);
      const status = await getRenderStatus(queueGateway, jobId);

      if (!status) {
        return response.status(404).json({
          error: {
            code: "JOB_NOT_FOUND",
            message: "Render job was not found"
          }
        });
      }

      return response.json(status);
    })
  );

  return router;
}
