import type { RequestHandler } from "express";
import { HttpError } from "../errors/http-error";

export function createWebhookSecretGuard(secret?: string): RequestHandler {
  return (request, _response, next) => {
    if (!secret) {
      next();
      return;
    }

    const provided = request.headers["x-webhook-secret"];
    const token = Array.isArray(provided) ? provided[0] : provided;

    if (!token || token !== secret) {
      next(new HttpError(401, "Invalid webhook secret"));
      return;
    }

    next();
  };
}
