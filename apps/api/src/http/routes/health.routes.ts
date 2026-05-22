import { Router } from "express";

export function createHealthRouter() {
  const router = Router();

  router.get("/", (_request, response) => {
    response.json({
      ok: true,
      service: "api",
      time: new Date().toISOString()
    });
  });

  return router;
}

