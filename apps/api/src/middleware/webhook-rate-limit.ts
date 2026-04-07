import type { RequestHandler } from "express";
import { HttpError } from "../errors/http-error";

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export function createWebhookRateLimiter(options: RateLimitOptions): RequestHandler {
  const state = new Map<string, RateLimitEntry>();

  return (request, _response, next) => {
    const now = Date.now();
    const key = `${request.ip}:${request.path}`;
    const existing = state.get(key);

    if (!existing || now > existing.resetAt) {
      state.set(key, {
        count: 1,
        resetAt: now + options.windowMs
      });
      next();
      return;
    }

    if (existing.count >= options.maxRequests) {
      next(new HttpError(429, "Webhook rate limit exceeded. Try again later."));
      return;
    }

    existing.count += 1;
    state.set(key, existing);
    next();
  };
}
