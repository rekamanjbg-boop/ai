import { Router } from "express";
import { createRenderJob } from "../../application/jobs/create-render-job.js";
import { createRenderJobSchema } from "../../domain/jobs/job.schema.js";
import { asyncHandler } from "../middleware/async-handler.js";
import type { QueueGateway } from "../../infrastructure/queue/queue-gateway.js";

export function createJobsRouter(queueGateway: QueueGateway) {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (request, response) => {
      const input = createRenderJobSchema.parse(request.body);
      const result = await createRenderJob(queueGateway, input);
      response.status(202).json(result);
    })
  );

  return router;
}

