import type { NextFunction, Request, RequestHandler, Response } from "express";

export function asyncHandler(
  fn: (request: Request, response: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return function wrapped(request, response, next) {
    void fn(request, response, next).catch(next);
  };
}
