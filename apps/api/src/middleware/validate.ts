import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";
import { HttpError } from "../errors/http-error";

export function validateBody<TSchema extends ZodTypeAny>(schema: TSchema): RequestHandler {
  return (request, _response, next) => {
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      next(new HttpError(400, "Invalid request body", parsed.error.flatten()));
      return;
    }
    request.body = parsed.data;
    next();
  };
}

export function validateQuery<TSchema extends ZodTypeAny>(schema: TSchema): RequestHandler {
  return (request, _response, next) => {
    const parsed = schema.safeParse(request.query);
    if (!parsed.success) {
      next(new HttpError(400, "Invalid query string", parsed.error.flatten()));
      return;
    }
    request.query = parsed.data;
    next();
  };
}

export function validateParams<TSchema extends ZodTypeAny>(schema: TSchema): RequestHandler {
  return (request, _response, next) => {
    const parsed = schema.safeParse(request.params);
    if (!parsed.success) {
      next(new HttpError(400, "Invalid route params", parsed.error.flatten()));
      return;
    }
    request.params = parsed.data;
    next();
  };
}
