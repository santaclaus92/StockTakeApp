import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { createInMemoryStaRepository } from "../src/repositories/memory-sta-repository";

describe("strict auth mode", () => {
  it("rejects requests without bearer token when auth is required", async () => {
    const app = createApp({
      repository: createInMemoryStaRepository(),
      authRequired: true,
      devFallbackRole: "Admin",
      authVerifier: {
        verifyToken: async () => null
      }
    });

    const response = await request(app).get("/api/sessions");
    expect(response.status).toBe(401);
  });

  it("allows admin token in strict mode", async () => {
    const app = createApp({
      repository: createInMemoryStaRepository(),
      authRequired: true,
      devFallbackRole: "User",
      authVerifier: {
        verifyToken: async (token) => {
          if (token !== "valid-admin-token") return null;
          return {
            id: "u-admin",
            email: "admin@example.com",
            role: "Admin"
          };
        }
      }
    });

    const response = await request(app)
      .get("/api/sessions")
      .set("Authorization", "Bearer valid-admin-token");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it("denies user role from admin-only endpoint in strict mode", async () => {
    const app = createApp({
      repository: createInMemoryStaRepository(),
      authRequired: true,
      devFallbackRole: "User",
      authVerifier: {
        verifyToken: async (token) => {
          if (token !== "valid-user-token") return null;
          return {
            id: "u-user",
            email: "user@example.com",
            role: "User"
          };
        }
      }
    });

    const response = await request(app)
      .post("/api/sessions")
      .set("Authorization", "Bearer valid-user-token")
      .send({
        name: "Blocked Session",
        type: "Year End",
        country: "Malaysia",
        entity: "BMS",
        startDate: "2026-12-01",
        endDate: "2026-12-31"
      });

    expect(response.status).toBe(403);
  });

  it("allows user role to list only active visible sessions", async () => {
    const app = createApp({
      repository: createInMemoryStaRepository(),
      authRequired: true,
      devFallbackRole: "User",
      authVerifier: {
        verifyToken: async (token) => {
          if (token !== "valid-user-token") return null;
          return {
            id: "u-user",
            email: "user@example.com",
            role: "User"
          };
        }
      }
    });

    const response = await request(app)
      .get("/api/sessions")
      .set("Authorization", "Bearer valid-user-token");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.every((session: { status: string; userVisible: boolean }) => session.status === "Active")).toBe(true);
    expect(response.body.every((session: { status: string; userVisible: boolean }) => session.userVisible === true)).toBe(true);
  });

  it("scopes user history to signed-in user context even if query asks for another name", async () => {
    const app = createApp({
      repository: createInMemoryStaRepository(),
      authRequired: true,
      devFallbackRole: "User",
      authVerifier: {
        verifyToken: async (token) => {
          if (token === "valid-user-token") {
            return {
              id: "u-user",
              email: "counter@example.com",
              role: "User"
            };
          }
          if (token === "valid-admin-token") {
            return {
              id: "u-admin",
              email: "admin@example.com",
              role: "Admin"
            };
          }
          return null;
        }
      }
    });

    const selfAudit = await request(app)
      .post("/api/audit")
      .set("Authorization", "Bearer valid-admin-token")
      .send({
        sessionId: "YE2026-MY-001",
        itemId: "I-1001",
        itemCode: "ITM-1001",
        itemName: "Hydraulic Pump A200",
        submittedBy: "Counter User",
        qty: 11,
        warehouse: "A-01"
      });
    expect(selfAudit.status).toBe(201);

    const outsiderAudit = await request(app)
      .post("/api/audit")
      .set("Authorization", "Bearer valid-admin-token")
      .send({
        sessionId: "YE2026-MY-001",
        itemId: "I-1002",
        itemCode: "ITM-1002",
        itemName: "Conveyor Belt 5m",
        submittedBy: "Outside User",
        qty: 12,
        warehouse: "B-02"
      });
    expect(outsiderAudit.status).toBe(201);

    const visibleHistory = await request(app)
      .get("/api/history")
      .set("Authorization", "Bearer valid-user-token");
    expect(visibleHistory.status).toBe(200);
    expect(Array.isArray(visibleHistory.body)).toBe(true);
    expect(visibleHistory.body.some((row: { submittedBy: string }) => row.submittedBy === "Counter User")).toBe(true);
    expect(visibleHistory.body.some((row: { submittedBy: string }) => row.submittedBy === "Outside User")).toBe(false);

    const forcedQuery = await request(app)
      .get("/api/history?submittedBy=Outside")
      .set("Authorization", "Bearer valid-user-token");
    expect(forcedQuery.status).toBe(200);
    expect(forcedQuery.body.some((row: { submittedBy: string }) => row.submittedBy === "Outside User")).toBe(false);
  });

  it("denies user role from users and roles endpoint", async () => {
    const app = createApp({
      repository: createInMemoryStaRepository(),
      authRequired: true,
      devFallbackRole: "User",
      authVerifier: {
        verifyToken: async (token) => {
          if (token !== "valid-user-token") return null;
          return {
            id: "u-user",
            email: "user@example.com",
            role: "User"
          };
        }
      }
    });

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", "Bearer valid-user-token");

    expect(response.status).toBe(403);
  });

  it("enforces strict-role counting: checker blocked, assigned counter allowed", async () => {
    const app = createApp({
      repository: createInMemoryStaRepository(),
      authRequired: true,
      devFallbackRole: "User",
      authVerifier: {
        verifyToken: async (token) => {
          if (token === "valid-admin-token") {
            return {
              id: "u-admin",
              email: "admin@example.com",
              role: "Admin"
            };
          }
          if (token === "valid-counter-token") {
            return {
              id: "u-counter",
              email: "jarvis.ng@example.com",
              role: "User"
            };
          }
          if (token === "valid-checker-token") {
            return {
              id: "u-checker",
              email: "lim.eng@example.com",
              role: "User"
            };
          }
          return null;
        }
      }
    });

    const userImport = await request(app)
      .post("/api/webhooks/users/import")
      .set("Authorization", "Bearer valid-admin-token")
      .send({
        data: [
          { id: "U-JARVIS", display_name: "Jarvis Ng", email_address: "jarvis.ng@example.com" },
          { id: "U-LIM", display_name: "Lim Eng", email_address: "lim.eng@example.com" }
        ]
      });
    expect(userImport.status).toBe(201);

    const strictToggle = await request(app)
      .post("/api/sessions/YE2026-MY-001/toggle-strict-roles")
      .set("Authorization", "Bearer valid-admin-token")
      .send({});
    expect(strictToggle.status).toBe(200);
    expect(strictToggle.body.strictRoles).toBe(true);

    const checkerAttempt = await request(app)
      .post("/api/warehouse/counts")
      .set("Authorization", "Bearer valid-checker-token")
      .send({
        itemId: "I-1002",
        qty: 12,
        submittedBy: "Lim Eng"
      });
    expect(checkerAttempt.status).toBe(403);
    expect(checkerAttempt.body.message).toContain("checker cannot submit counts");

    const counterAttempt = await request(app)
      .post("/api/warehouse/counts")
      .set("Authorization", "Bearer valid-counter-token")
      .send({
        itemId: "I-1002",
        qty: 13,
        submittedBy: "Spoofed Name"
      });
    expect(counterAttempt.status).toBe(201);

    const audit = await request(app)
      .get("/api/sessions/YE2026-MY-001/audit")
      .set("Authorization", "Bearer valid-admin-token");
    expect(audit.status).toBe(200);
    expect(audit.body[0].itemCode).toBe("ITM-1002");
    expect(audit.body[0].submittedBy).toBe("Jarvis Ng");
  });
});
