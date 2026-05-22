import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requestContextMiddleware(request: Request, response: Response, next: NextFunction) {
  const requestId = request.header("x-request-id") ?? randomUUID();
  response.setHeader("x-request-id", requestId);
  next();
}

