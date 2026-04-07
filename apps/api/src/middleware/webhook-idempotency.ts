import type { RequestHandler } from "express";

interface IdempotencyOptions {
  ttlMs: number;
  headerName?: string;
}

interface IdempotencyEntry {
  expiresAt: number;
  statusCode: number;
  body: unknown;
}

export function createWebhookIdempotencyGuard(options: IdempotencyOptions): RequestHandler {
  const headerName = (options.headerName ?? "idempotency-key").toLowerCase();
  const store = new Map<string, IdempotencyEntry>();

  return (request, response, next) => {
    const headerValue = request.headers[headerName];
    const idempotencyKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!idempotencyKey || !idempotencyKey.trim()) {
      next();
      return;
    }

    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.expiresAt <= now) {
        store.delete(key);
      }
    }

    const cacheKey = `${request.method}:${request.path}:${idempotencyKey.trim()}`;
    const existing = store.get(cacheKey);

    if (existing && existing.expiresAt > now) {
      response.setHeader("x-idempotent-replay", "true");
      response.status(existing.statusCode).json(existing.body);
      return;
    }

    const originalJson = response.json.bind(response);
    response.json = ((payload: unknown) => {
      store.set(cacheKey, {
        expiresAt: Date.now() + options.ttlMs,
        statusCode: response.statusCode,
        body: payload
      });
      return originalJson(payload);
    }) as typeof response.json;

    next();
  };
}
