import type { Request, Response } from "express";
import { HttpError } from "../errors/http-error";
import type { UserRole } from "../middleware/auth";
import { StaService } from "../services/sta-service";
import type { AuthPrecheckBody, AuthResolveBody } from "../validation/schemas";

export interface AuthMetadataSync {
  syncRole: (userId: string, role: UserRole) => Promise<void>;
}

export class AuthController {
  constructor(
    private readonly service: StaService,
    private readonly metadataSync?: AuthMetadataSync
  ) {}

  precheckEmail = async (request: Request, response: Response) => {
    const body = request.body as AuthPrecheckBody;
    const normalizedEmail = body.email.trim().toLowerCase();

    const user = await this.service.findUserByEmail(normalizedEmail);
    if (!user || user.accountEnabled === false) {
      throw new HttpError(404, "Email not found in user directory");
    }

    response.status(200).json({
      found: true,
      id: user.id,
      email: user.email ?? normalizedEmail,
      name: user.name,
      role: user.role
    });
  };

  resolveIdentity = async (request: Request, response: Response) => {
    const header = request.headers.authorization;
    const hasBearer = Boolean(header?.startsWith("Bearer "));
    if (!hasBearer) {
      throw new HttpError(401, "Missing bearer token");
    }

    const authUser = request.authUser;
    if (!authUser || !authUser.email) {
      throw new HttpError(401, "Invalid authenticated user context");
    }

    const body = (request.body ?? {}) as AuthResolveBody;
    const tokenEmail = authUser.email.trim().toLowerCase();
    if (body.email && body.email.trim().toLowerCase() !== tokenEmail) {
      throw new HttpError(403, "Authenticated email does not match requested email");
    }

    const user = await this.service.findUserByEmail(tokenEmail);
    if (!user || user.accountEnabled === false) {
      throw new HttpError(403, "User is not allowed to access this application");
    }

    if (this.metadataSync) {
      await this.metadataSync.syncRole(authUser.id, user.role);
    }

    response.status(200).json({
      id: authUser.id,
      email: user.email ?? tokenEmail,
      name: user.name,
      role: user.role
    });
  };
}
