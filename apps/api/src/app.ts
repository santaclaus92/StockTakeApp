import express from "express";
import { AdminController } from "./controllers/admin.controller";
import { AuthController } from "./controllers/auth.controller";
import type { AuthMetadataSync } from "./controllers/auth.controller";
import { WarehouseController } from "./controllers/warehouse.controller";
import { WebhookController } from "./controllers/webhook.controller";
import type { AuthVerifier, UserRole } from "./middleware/auth";
import { createAuthMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/error-handler";
import { attachRequestContext } from "./middleware/request-context";
import { requestLogger } from "./middleware/request-logger";
import { createWebhookIdempotencyGuard } from "./middleware/webhook-idempotency";
import { createWebhookRateLimiter } from "./middleware/webhook-rate-limit";
import { createWebhookSecretGuard } from "./middleware/webhook-secret";
import { createInMemoryStaRepository } from "./repositories/memory-sta-repository";
import type { StaRepository } from "./repositories/sta-repository";
import { healthRouter } from "./routes/health.route";
import { createAdminRouter } from "./routes/admin.route";
import { createAuthRouter } from "./routes/auth.route";
import { createWarehouseRouter } from "./routes/warehouse.route";
import { createWebhookRouter } from "./routes/webhook.route";
import { StaService } from "./services/sta-service";

interface CreateAppOptions {
  repository?: StaRepository;
  authVerifier?: AuthVerifier;
  authRequired?: boolean;
  devFallbackRole?: UserRole;
  webhookSharedSecret?: string;
  webhookRateLimitWindowMs?: number;
  webhookRateLimitMax?: number;
  webhookIdempotencyTtlMs?: number;
  authMetadataSync?: AuthMetadataSync;
}

const passthroughAuthVerifier: AuthVerifier = {
  verifyToken: async () => null
};

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const repository = options.repository ?? createInMemoryStaRepository();
  const authVerifier = options.authVerifier ?? passthroughAuthVerifier;
  const authRequired = options.authRequired ?? false;
  const devFallbackRole = options.devFallbackRole ?? "Admin";
  const webhookSharedSecret = options.webhookSharedSecret;
  const webhookRateLimitWindowMs = options.webhookRateLimitWindowMs ?? 60_000;
  const webhookRateLimitMax = options.webhookRateLimitMax ?? 30;
  const webhookIdempotencyTtlMs = options.webhookIdempotencyTtlMs ?? 10 * 60_000;
  const authMetadataSync = options.authMetadataSync;

  const service = new StaService(repository);
  const adminController = new AdminController(service, authMetadataSync);
  const authController = new AuthController(service, authMetadataSync);
  const warehouseController = new WarehouseController(service);
  const webhookController = new WebhookController(service);

  app.use(express.json({ limit: "2mb" }));
  app.use(attachRequestContext);
  app.use(requestLogger);
  app.use((request, response, next) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-webhook-secret");
    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }
    next();
  });

  app.use("/api", healthRouter);
  app.use(
    createAuthMiddleware(authVerifier, {
      authRequired,
      devFallbackRole,
      publicPaths: ["/api/auth/precheck"]
    })
  );

  app.use("/api", createAuthRouter(authController));
  app.use("/api", createAdminRouter(adminController));
  app.use("/api", createWarehouseRouter(warehouseController));
  app.use(
    "/api/webhooks",
    createWebhookSecretGuard(webhookSharedSecret),
    createWebhookRateLimiter({
      windowMs: webhookRateLimitWindowMs,
      maxRequests: webhookRateLimitMax
    }),
    createWebhookIdempotencyGuard({
      ttlMs: webhookIdempotencyTtlMs
    })
  );
  app.use("/api", createWebhookRouter(webhookController));

  app.use(errorHandler);

  return app;
}

export const app = createApp();
