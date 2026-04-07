import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { isHttpError } from "../errors/http-error";
import { mapUnexpectedError } from "../lib/error-mapper";

export const errorHandler: ErrorRequestHandler = (error, request, response, next) => {
  void next;
  const requestId = response.getHeader("x-request-id") ?? null;

  if (isHttpError(error)) {
    response.status(error.statusCode).json({
      message: error.message,
      details: error.details,
      requestId
    });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      message: "Validation failed",
      details: error.flatten(),
      requestId
    });
    return;
  }

  const mapped = mapUnexpectedError(error);

  console.error("[api:error]", {
    requestId,
    method: request.method,
    path: request.path,
    statusCode: mapped.statusCode,
    error
  });

  response.status(mapped.statusCode).json({
    message: mapped.message,
    details: mapped.details,
    requestId
  });
};
