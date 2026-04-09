import type { RequestHandler } from "express";
import { HttpError } from "../errors/http-error";

export type UserRole = "User" | "Admin" | "Super Admin";

export interface AuthUser {
  id: string;
  email: string | null;
  role: UserRole;
}

export interface AuthVerifier {
  verifyToken: (token: string) => Promise<AuthUser | null>;
}

interface AuthOptions {
  authRequired: boolean;
  devFallbackRole: UserRole;
  publicPaths?: string[];
}

export function createAuthMiddleware(verifier: AuthVerifier, options: AuthOptions): RequestHandler {
  return async (request, _response, next) => {
    const isPublic = options.publicPaths?.some(
      (p) => request.path === p || request.path.startsWith(p + "/")
    );
    if (isPublic) {
      next();
      return;
    }

    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";

    if (token) {
      const verified = await verifier.verifyToken(token);
      if (!verified) {
        next(new HttpError(401, "Unauthorized"));
        return;
      }
      request.authUser = verified;
      next();
      return;
    }

    if (options.authRequired) {
      next(new HttpError(401, "Missing bearer token"));
      return;
    }

    request.authUser = {
      id: "dev-user",
      email: null,
      role: options.devFallbackRole
    };
    next();
  };
}

export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    const role = request.authUser?.role;
    if (!role) {
      next(new HttpError(401, "Unauthorized"));
      return;
    }

    if (!allowedRoles.includes(role)) {
      next(new HttpError(403, "Forbidden"));
      return;
    }

    next();
  };
}
