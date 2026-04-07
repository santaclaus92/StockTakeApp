import { Router } from "express";
import { WebhookController } from "../controllers/webhook.controller";
import { asyncHandler } from "../middleware/async-handler";
import { requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { webhookImportBinsSchema, webhookImportItemsSchema, webhookImportUsersSchema } from "../validation/schemas";

export function createWebhookRouter(controller: WebhookController): Router {
  const router = Router();

  router.post(
    "/webhooks/bins/import",
    requireRole("Admin", "Super Admin"),
    validateBody(webhookImportBinsSchema),
    asyncHandler(controller.importBins)
  );

  router.post(
    "/webhooks/users/import",
    requireRole("Admin", "Super Admin"),
    validateBody(webhookImportUsersSchema),
    asyncHandler(controller.importUsers)
  );

  router.post(
    "/webhooks/items/import",
    requireRole("Admin", "Super Admin"),
    validateBody(webhookImportItemsSchema),
    asyncHandler(controller.importItems)
  );

  return router;
}
