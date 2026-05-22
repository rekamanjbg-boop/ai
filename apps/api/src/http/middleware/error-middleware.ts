import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export const errorMiddleware: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    return response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        issues: error.issues
      }
    });
  }

  const statusCode = typeof error.statusCode === "number" ? error.statusCode : 500;

  return response.status(statusCode).json({
    error: {
      code: statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
      message: statusCode >= 500 ? "Unexpected server error" : error.message
    }
  });
};

