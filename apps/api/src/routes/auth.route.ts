import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { asyncHandler } from "../middleware/async-handler";
import { validateBody } from "../middleware/validate";
import { authPrecheckSchema, authResolveSchema } from "../validation/schemas";

export function createAuthRouter(controller: AuthController): Router {
  const router = Router();

  router.post("/auth/precheck", validateBody(authPrecheckSchema), asyncHandler(controller.precheckEmail));
  router.post("/auth/resolve-identity", validateBody(authResolveSchema), asyncHandler(controller.resolveIdentity));

  return router;
}
