import { Router } from "express";
import { createAiVideoJobSchema } from "../../domain/jobs/job.schema.js";
import { asyncHandler } from "../middleware/async-handler.js";
import type { QueueGateway } from "../../infrastructure/queue/queue-gateway.js";

export function createVideoRouter(queueGateway: QueueGateway) {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (request, response) => {
      const input = createAiVideoJobSchema.parse(request.body);
      const job = await queueGateway.createAiVideoJob(input);

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

  return router;
}
