import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { createInMemoryStaRepository } from "../src/repositories/memory-sta-repository";
import type { NewSessionInput, Session } from "../src/domain/types";

describe("section 3 hardening", () => {
  it("blocks webhook calls without shared secret when secret is configured", async () => {
    const app = createApp({
      repository: createInMemoryStaRepository(),
      authRequired: false,
      devFallbackRole: "Admin",
      webhookSharedSecret: "top-secret"
    });

    const unauthorized = await request(app).post("/api/webhooks/bins/import").send({ data: [] });
    expect(unauthorized.status).toBe(401);

    const authorized = await request(app)
      .post("/api/webhooks/bins/import")
      .set("x-webhook-secret", "top-secret")
      .send({ data: [] });

    expect(authorized.status).toBe(201);
  });

  it("enforces webhook rate limiting", async () => {
    const app = createApp({
      repository: createInMemoryStaRepository(),
      authRequired: false,
      devFallbackRole: "Admin",
      webhookRateLimitWindowMs: 60_000,
      webhookRateLimitMax: 1
    });

    const first = await request(app).post("/api/webhooks/users/import").send({ data: [] });
    expect(first.status).toBe(201);

    const second = await request(app).post("/api/webhooks/users/import").send({ data: [] });
    expect(second.status).toBe(429);
  });

  it("replays webhook responses for repeated idempotency key", async () => {
    const app = createApp({
      repository: createInMemoryStaRepository(),
      authRequired: false,
      devFallbackRole: "Admin",
      webhookIdempotencyTtlMs: 300_000
    });

    const payload = {
      sessionId: "CC2026-SG-001",
      data: [{ id: "I-3001", code: "ITM-3001", name: "Idempotent Item", sap_qty: 10 }]
    };

    const first = await request(app)
      .post("/api/webhooks/items/import")
      .set("idempotency-key", "abc-123")
      .send(payload);

    expect(first.status).toBe(201);
    expect(first.body.imported).toBe(1);

    const replay = await request(app)
      .post("/api/webhooks/items/import")
      .set("idempotency-key", "abc-123")
      .send(payload);

    expect(replay.status).toBe(201);
    expect(replay.headers["x-idempotent-replay"]).toBe("true");
    expect(replay.body).toEqual(first.body);
  });

  it("maps duplicate database errors to http 409", async () => {
    const repository = createInMemoryStaRepository();
    const override = repository as unknown as {
      createSession: (input: NewSessionInput) => Promise<Session>;
    };

    override.createSession = async () => {
      throw {
        code: "23505",
        message: "duplicate key value violates unique constraint",
        details: "Key (id) already exists."
      };
    };

    const app = createApp({
      repository,
      authRequired: false,
      devFallbackRole: "Admin"
    });

    const response = await request(app).post("/api/sessions").send({
      name: "Duplicate Session",
      type: "Year End",
      country: "Malaysia",
      entity: "BMS",
      startDate: "2026-12-01",
      endDate: "2026-12-31"
    });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Duplicate record detected.");
    expect(response.headers["x-request-id"]).toBeDefined();
    expect(response.body.requestId).toBeTruthy();
  });
});
