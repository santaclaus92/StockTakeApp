import type { RequestHandler } from "express";

interface RequestLogRecord {
  timestamp: string;
  requestId: string | number | string[] | null;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ip: string;
  userAgent: string;
  userId: string | null;
}

export const requestLogger: RequestHandler = (request, response, next) => {
  const startedAt = process.hrtime.bigint();

  response.on("finish", () => {
    const endedAt = process.hrtime.bigint();
    const durationMs = Number(endedAt - startedAt) / 1_000_000;

    const record: RequestLogRecord = {
      timestamp: new Date().toISOString(),
      requestId: response.getHeader("x-request-id") ?? null,
      method: request.method,
      path: request.originalUrl,
      statusCode: response.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ip: request.ip ?? "",
      userAgent: request.get("user-agent") ?? "",
      userId: request.authUser?.id ?? null
    };

    console.log(JSON.stringify(record));
  });

  next();
};
