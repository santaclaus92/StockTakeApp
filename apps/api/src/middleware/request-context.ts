import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const attachRequestContext: RequestHandler = (_request, response, next) => {
  response.setHeader("x-request-id", randomUUID());
  next();
};
