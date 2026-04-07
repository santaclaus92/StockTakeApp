import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { createInMemoryStaRepository } from "../src/repositories/memory-sta-repository";

function buildApp() {
  return createApp({
    repository: createInMemoryStaRepository(),
    authRequired: false,
    devFallbackRole: "Admin"
  });
}

describe("section 2 api routes", () => {
  let app = buildApp();
  const originalApiKey = process.env.API_KEY;
  const originalPaBinsUrl = process.env.PA_BINS_URL;
  const originalPaUsersUrl = process.env.PA_USERS_URL;
  const originalPaItemsUrl = process.env.PA_ITEMS_URL;
  const originalPaBinsPageSize = process.env.PA_BINS_PAGE_SIZE;
  const originalPaBinsMaxPages = process.env.PA_BINS_MAX_PAGES;
  const originalPaUsersPageSize = process.env.PA_USERS_PAGE_SIZE;
  const originalPaUsersMaxPages = process.env.PA_USERS_MAX_PAGES;
  const originalPaItemsPageSize = process.env.PA_ITEMS_PAGE_SIZE;
  const originalPaItemsMaxPages = process.env.PA_ITEMS_MAX_PAGES;

  beforeEach(() => {
    app = buildApp();
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.API_KEY;
    } else {
      process.env.API_KEY = originalApiKey;
    }

    if (originalPaItemsUrl === undefined) {
      delete process.env.PA_ITEMS_URL;
    } else {
      process.env.PA_ITEMS_URL = originalPaItemsUrl;
    }

    if (originalPaBinsUrl === undefined) {
      delete process.env.PA_BINS_URL;
    } else {
      process.env.PA_BINS_URL = originalPaBinsUrl;
    }

    if (originalPaUsersUrl === undefined) {
      delete process.env.PA_USERS_URL;
    } else {
      process.env.PA_USERS_URL = originalPaUsersUrl;
    }

    if (originalPaItemsPageSize === undefined) {
      delete process.env.PA_ITEMS_PAGE_SIZE;
    } else {
      process.env.PA_ITEMS_PAGE_SIZE = originalPaItemsPageSize;
    }

    if (originalPaItemsMaxPages === undefined) {
      delete process.env.PA_ITEMS_MAX_PAGES;
    } else {
      process.env.PA_ITEMS_MAX_PAGES = originalPaItemsMaxPages;
    }

    if (originalPaBinsPageSize === undefined) {
      delete process.env.PA_BINS_PAGE_SIZE;
    } else {
      process.env.PA_BINS_PAGE_SIZE = originalPaBinsPageSize;
    }

    if (originalPaBinsMaxPages === undefined) {
      delete process.env.PA_BINS_MAX_PAGES;
    } else {
      process.env.PA_BINS_MAX_PAGES = originalPaBinsMaxPages;
    }

    if (originalPaUsersPageSize === undefined) {
      delete process.env.PA_USERS_PAGE_SIZE;
    } else {
      process.env.PA_USERS_PAGE_SIZE = originalPaUsersPageSize;
    }

    if (originalPaUsersMaxPages === undefined) {
      delete process.env.PA_USERS_MAX_PAGES;
    } else {
      process.env.PA_USERS_MAX_PAGES = originalPaUsersMaxPages;
    }

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates and returns sessions through api", async () => {
    const createResponse = await request(app).post("/api/sessions").send({
      name: "Cycle Count MY May",
      type: "Cycle Count",
      country: "Malaysia",
      entity: "BMS",
      startDate: "2026-05-01",
      endDate: "2026-05-31"
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.name).toBe("Cycle Count MY May");

    const listResponse = await request(app).get("/api/sessions");
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.some((row: { name: string }) => row.name === "Cycle Count MY May")).toBe(true);
  });

  it("supports session lifecycle actions (update, end, reopen, visibility, delete)", async () => {
    const createResponse = await request(app).post("/api/sessions").send({
      name: "Lifecycle Session",
      type: "Cycle Count",
      country: "Malaysia",
      entity: "BMS",
      startDate: "2026-05-01",
      endDate: "2026-05-31"
    });

    expect(createResponse.status).toBe(201);
    const sessionId = createResponse.body.id as string;

    const updated = await request(app).patch(`/api/sessions/${sessionId}`).send({
      name: "Lifecycle Session Updated",
      type: "Cycle Count",
      country: "Malaysia",
      entity: "BMS",
      startDate: "2026-05-01",
      endDate: "2026-06-01",
      isRecount: false
    });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe("Lifecycle Session Updated");

    const visibility = await request(app).post(`/api/sessions/${sessionId}/toggle-visibility`).send({});
    expect(visibility.status).toBe(200);
    expect(visibility.body.userVisible).toBe(true);
    expect(visibility.body.status).toBe("Active");

    const ended = await request(app).post(`/api/sessions/${sessionId}/end`).send({});
    expect(ended.status).toBe(200);
    expect(ended.body.status).toBe("Closed");
    expect(ended.body.progress).toBe(100);

    const reopened = await request(app).post(`/api/sessions/${sessionId}/reopen`).send({});
    expect(reopened.status).toBe(200);
    expect(reopened.body.status).toBe("Active");

    const deleted = await request(app).delete(`/api/sessions/${sessionId}`).send({ deletedBy: "test-suite" });
    expect(deleted.status).toBe(200);
    expect(deleted.body.deleted).toBe(true);

    const listResponse = await request(app).get("/api/sessions");
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.some((row: { id: string }) => row.id === sessionId)).toBe(false);
  });

  it("supports pair create update delete via flat endpoints", async () => {
    const created = await request(app).post("/api/pairs").send({
      sessionId: "YE2026-MY-001",
      counter: "Counter One",
      checker: "Checker One",
      warehouse: "A-01",
      role: "User"
    });

    expect(created.status).toBe(201);

    const pairId = created.body.id as string;

    const updated = await request(app).put(`/api/pairs/${pairId}`).send({
      sessionId: "YE2026-MY-001",
      counter: "Counter Two",
      checker: "Checker Two",
      warehouse: "A-02",
      role: "Admin"
    });

    expect(updated.status).toBe(200);
    expect(updated.body.counter).toBe("Counter Two");

    const deleted = await request(app).delete(`/api/pairs/${pairId}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.deleted).toBe(true);
  });

  it("supports attendance write and toggle", async () => {
    const sameDateSession = await request(app).post("/api/sessions").send({
      name: "Year End 2026 Malaysia Extra",
      type: "Year End",
      country: "Malaysia",
      entity: "BMS",
      startDate: "2026-12-20",
      endDate: "2026-12-31"
    });
    expect(sameDateSession.status).toBe(201);

    const upserted = await request(app).post("/api/attendance").send({
      sessionId: "YE2026-MY-001",
      userId: "U-999",
      name: "Test User",
      attended: true,
      checkIn: "2026-04-04T10:00:00.000Z"
    });

    expect(upserted.status).toBe(201);
    expect(upserted.body.userId).toBe("U-999");

    const toggled = await request(app).patch("/api/sessions/YE2026-MY-001/attendance/U-999/toggle");
    expect(toggled.status).toBe(200);
    expect(toggled.body.attended).toBe(false);

    const minuteToken = Math.floor(Date.now() / 60_000);
    const scanned = await request(app).post("/api/attendance/scan").send({
      token: `att:YE2026-MY-001:${minuteToken}`,
      userId: "U-CNT-1",
      name: "Counter User"
    });
    expect(scanned.status).toBe(201);
    expect(scanned.body.sessionId).toBe("YE2026-MY-001");
    expect(scanned.body.attended).toBe(true);
    expect(Array.isArray(scanned.body.affectedSessionIds)).toBe(true);
    expect(scanned.body.affectedSessionIds).toContain("YE2026-MY-001");
    expect(scanned.body.affectedSessionIds).toContain(sameDateSession.body.id);

    const scannedSessionAttendance = await request(app).get("/api/sessions/YE2026-MY-001/attendance");
    expect(scannedSessionAttendance.status).toBe(200);
    expect(scannedSessionAttendance.body.some((row: { userId: string }) => row.userId === "U-CNT-1")).toBe(true);

    const secondSessionAttendance = await request(app).get(`/api/sessions/${sameDateSession.body.id}/attendance`);
    expect(secondSessionAttendance.status).toBe(200);
    expect(secondSessionAttendance.body.some((row: { userId: string }) => row.userId === "U-CNT-1")).toBe(true);
  });

  it("updates item count and reflects in warehouse submit", async () => {
    const updated = await request(app)
      .patch("/api/sessions/YE2026-MY-001/items/I-1001/count")
      .send({ countQty: 51 });

    expect(updated.status).toBe(200);
    expect(updated.body.countQty).toBe(51);

    const submitted = await request(app).post("/api/warehouse/counts").send({
      itemId: "I-1003",
      qty: 301,
      submittedBy: "Warehouse Tester",
      damagedQty: 2,
      expiredQty: 1,
      remark: "Manual recount"
    });

    expect(submitted.status).toBe(201);

    const items = await request(app).get("/api/sessions/YE2026-MY-001/items");
    const target = items.body.find((row: { id: string }) => row.id === "I-1003");
    expect(target.countQty).toBe(301);

    const audit = await request(app).get("/api/sessions/YE2026-MY-001/audit");
    expect(audit.status).toBe(200);
    expect(audit.body[0].damagedQty).toBe(2);
    expect(audit.body[0].expiredQty).toBe(1);
  });

  it("creates new items with extended warehouse submission fields", async () => {
    const created = await request(app).post("/api/new-items").send({
      sessionId: "YE2026-MY-001",
      code: "NEW-9988",
      name: "Handheld Scanner",
      uom: "PCS",
      batch: "BT-9988",
      warehouse: "A-09",
      qty: 3,
      damagedQty: 1,
      expiredQty: 0,
      remark: "Found during recount",
      photos: ["scanner-1.jpg", "scanner-2.jpg"],
      submittedBy: "Warehouse Tester"
    });

    expect(created.status).toBe(201);
    expect(created.body.code).toBe("NEW-9988");
    expect(created.body.uom).toBe("PCS");
    expect(created.body.batch).toBe("BT-9988");
    expect(created.body.qty).toBe(3);
    expect(created.body.photos).toEqual(["scanner-1.jpg", "scanner-2.jpg"]);

    const listed = await request(app).get("/api/sessions/YE2026-MY-001/new-items");
    expect(listed.status).toBe(200);
    expect(listed.body[0].code).toBe("NEW-9988");

    const items = await request(app).get("/api/sessions/YE2026-MY-001/items");
    expect(items.status).toBe(200);
    const mirroredItem = items.body.find((row: { code: string }) => row.code === "NEW-9988");
    expect(mirroredItem).toBeTruthy();
    expect(mirroredItem.batch).toBe("BT-9988");
    expect(mirroredItem.uom).toBe("PCS");
    expect(mirroredItem.countQty).toBe(3);
  });

  it("supports strict-role toggle, item advanced update, and dashboard details", async () => {
    const strictRoles = await request(app).post("/api/sessions/YE2026-MY-001/toggle-strict-roles").send({});
    expect(strictRoles.status).toBe(200);
    expect(strictRoles.body.strictRoles).toBe(true);

    const itemPatch = await request(app).patch("/api/sessions/YE2026-MY-001/items/I-1001").send({
      dropped: true,
      adminRemark: "Dropped due to damaged packaging"
    });
    expect(itemPatch.status).toBe(200);
    expect(itemPatch.body.dropped).toBe(true);
    expect(itemPatch.body.adminRemark).toContain("Dropped");

    const bulkAssign = await request(app).post("/api/sessions/YE2026-MY-001/items/bulk-assign").send({
      itemIds: ["I-1002", "I-1003"],
      pairId: "P-02",
      assignedTo: "Pair P-02"
    });
    expect(bulkAssign.status).toBe(200);
    expect(bulkAssign.body.updated).toBe(2);

    const details = await request(app).get("/api/sessions/YE2026-MY-001/dashboard/details");
    expect(details.status).toBe(200);
    expect(Array.isArray(details.body.byGroup)).toBe(true);
    expect(Array.isArray(details.body.byWarehouse)).toBe(true);
    expect(details.body.byWarehouse.some((row: { key: string }) => row.key === "WH-A")).toBe(true);
    expect(details.body.byWarehouse.some((row: { key: string }) => row.key === "WH-B")).toBe(true);
  });

  it("imports SAP items through session import endpoint using payload fallback", async () => {
    const imported = await request(app)
      .post("/api/sessions/CC2026-SG-001/items/import-from-sap")
      .send({
        entity: "BMSG",
        data: [
          {
            id: "SAP-501",
            item_code: "ITM-501",
            item_name: "Imported Valve",
            item_location: "S-11",
            wh_code: "WH-SG-01",
            sap_qty: 17
          },
          {
            id: "SAP-502",
            item_code: "ITM-502",
            item_name: "Imported Sensor",
            binLocation: "S-12",
            whCode: "WH-SG-02",
            sap_qty: 33
          }
        ]
      });

    expect(imported.status).toBe(201);
    expect(imported.body.imported).toBe(2);
    expect(imported.body.received).toBe(2);

    const items = await request(app).get("/api/sessions/CC2026-SG-001/items");
    expect(items.status).toBe(200);
    expect(items.body.length).toBe(2);
    const valve = items.body.find((row: { code: string }) => row.code === "ITM-501");
    const sensor = items.body.find((row: { code: string }) => row.code === "ITM-502");
    expect(valve).toBeTruthy();
    expect(sensor).toBeTruthy();
    expect(valve.whCode).toBe("WH-SG-01");
    expect(valve.warehouse).toBe("S-11");
    expect(sensor.whCode).toBe("WH-SG-02");
    expect(sensor.warehouse).toBe("S-12");
    expect(valve.dropped).toBe(false);
  });

  it("supports history and user role management endpoints", async () => {
    const history = await request(app).get("/api/history?submittedBy=Siti");
    expect(history.status).toBe(200);
    expect(Array.isArray(history.body)).toBe(true);

    const users = await request(app).get("/api/users");
    expect(users.status).toBe(200);
    expect(users.body.length).toBeGreaterThan(0);
    const userId = users.body[0].id as string;

    const roleUpdate = await request(app).patch(`/api/users/${userId}/role`).send({ role: "Admin" });
    expect(roleUpdate.status).toBe(200);
    expect(roleUpdate.body.role).toBe("Admin");
  });

  it("prevents double-review replay for the same approval record", async () => {
    const firstReview = await request(app).post("/api/sessions/YE2026-MY-001/approvals/APP-01/approve").send({});
    expect(firstReview.status).toBe(200);
    expect(firstReview.body.status).toBe("Approved");

    const secondReview = await request(app).post("/api/sessions/YE2026-MY-001/approvals/APP-01/approve").send({});
    expect(secondReview.status).toBe(409);
    expect(secondReview.body.message).toContain("already been reviewed");
  });

  it("supports auth precheck and resolve identity against users table", async () => {
    const precheck = await request(app).post("/api/auth/precheck").send({ email: "counter@example.com" });
    expect(precheck.status).toBe(200);
    expect(precheck.body.found).toBe(true);
    expect(precheck.body.role).toBe("User");

    const missing = await request(app).post("/api/auth/precheck").send({ email: "missing@example.com" });
    expect(missing.status).toBe(404);

    const authApp = createApp({
      repository: createInMemoryStaRepository(),
      authRequired: true,
      devFallbackRole: "Admin",
      authVerifier: {
        verifyToken: async (token: string) => {
          if (token === "counter-token") {
            return { id: "auth-counter-1", email: "counter@example.com", role: "User" as const };
          }
          return null;
        }
      }
    });

    const resolved = await request(authApp)
      .post("/api/auth/resolve-identity")
      .set("Authorization", "Bearer counter-token")
      .send({ email: "counter@example.com" });
    expect(resolved.status).toBe(200);
    expect(resolved.body.role).toBe("User");
    expect(resolved.body.email).toBe("counter@example.com");
  });

  it("imports items via webhook route", async () => {
    const imported = await request(app).post("/api/webhooks/items/import").send({
      sessionId: "CC2026-SG-001",
      data: [
        { id: "I-9001", code: "ITM-9001", name: "Imported Item", sap_qty: 88, item_location: "S-09" },
        { id: "I-9002", code: "ITM-9002", name: "Imported Item 2", sap_qty: 32, item_location: "S-10" }
      ]
    });

    expect(imported.status).toBe(201);
    expect(imported.body.imported).toBe(2);

    const items = await request(app).get("/api/sessions/CC2026-SG-001/items");
    expect(items.status).toBe(200);
    expect(items.body.length).toBe(2);
  });

  it("deduplicates bins import by warehouse id", async () => {
    const imported = await request(app).post("/api/webhooks/bins/import").send({
      data: [{ bin_location: "A-01" }, { id: "A-01", name: "Duplicate" }, { bin_location: "B-02" }]
    });

    expect(imported.status).toBe(201);
    expect(imported.body.imported).toBe(2);
  });

  it("imports bins directly from configured PA_BINS_URL endpoint", async () => {
    process.env.PA_BINS_URL = "https://example.test/sap-bins";
    process.env.API_KEY = "sap-test-key";

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [{ bin_location: "A-01", location_assigned: "Main A-01" }, { bin_location: "A-02", location_assigned: "Main A-02" }]
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const imported = await request(app).post("/api/bins/import-from-pa").send({});

    expect(imported.status).toBe(201);
    expect(imported.body.imported).toBe(2);
    expect(imported.body.received).toBe(2);
    expect(imported.body.pagesFetched).toBe(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.test/sap-bins");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sap-test-key");
    expect(headers.apikey).toBe("sap-test-key");
    const payload = JSON.parse(String(init.body));
    expect(payload.limit).toBe(1000);
    expect(payload.offset).toBe(0);
    expect(payload.page).toBe(1);
  });

  it("imports bins from PA_BINS_URL across pages", async () => {
    process.env.PA_BINS_URL = "https://example.test/sap-bins";
    process.env.PA_BINS_PAGE_SIZE = "2";
    process.env.PA_BINS_MAX_PAGES = "10";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            rows: [{ id: "A-01", location_assigned: "Main A-01" }, { id: "A-02", location_assigned: "Main A-02" }],
            hasMore: true,
            nextOffset: 2
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            rows: [{ id: "A-03", location_assigned: "Main A-03" }],
            hasMore: false
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const imported = await request(app).post("/api/bins/import-from-pa").send({});

    expect(imported.status).toBe(201);
    expect(imported.body.received).toBe(3);
    expect(imported.body.imported).toBe(3);
    expect(imported.body.pagesFetched).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [, firstInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const firstPayload = JSON.parse(String(firstInit.body));
    expect(firstPayload.limit).toBe(2);
    expect(firstPayload.offset).toBe(0);
    expect(firstPayload.page).toBe(1);

    const [, secondInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    const secondPayload = JSON.parse(String(secondInit.body));
    expect(secondPayload.offset).toBe(2);
    expect(secondPayload.page).toBe(2);
  });

  it("preserves Admin and Super Admin users during user import", async () => {
    const imported = await request(app).post("/api/webhooks/users/import").send({
      data: [
        { id: "U-CNT-1", display_name: "Counter User", email_address: "counter@example.com" },
        { id: "U-NEW-1", display_name: "New User", email_address: "new.user@example.com" },
        { id: "U-NEW-1", display_name: "New User Duplicate", email_address: "new.user@example.com" }
      ]
    });

    expect(imported.status).toBe(201);
    expect(imported.body.imported).toBe(4);

    const users = await request(app).get("/api/users");
    expect(users.status).toBe(200);

    const admin = users.body.find((row: { email: string | null; role: string }) => row.email === "admin@example.com");
    const superAdmin = users.body.find((row: { email: string | null; role: string }) => row.email === "superadmin@example.com");
    const newUser = users.body.find((row: { email: string | null; role: string }) => row.email === "new.user@example.com");

    expect(admin?.role).toBe("Admin");
    expect(superAdmin?.role).toBe("Super Admin");
    expect(newUser?.role).toBe("User");
  });

  it("imports users from PA_USERS_URL and can reset session assignments", async () => {
    process.env.PA_USERS_URL = "https://example.test/sap-users";
    process.env.API_KEY = "sap-test-key";

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [{ id: "U-JARVIS", display_name: "Jarvis Ng", email_address: "jarvis.ng@example.com" }]
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const imported = await request(app).post("/api/users/import-from-pa").send({
      sessionId: "YE2026-MY-001",
      resetSessionAssignments: true
    });

    expect(imported.status).toBe(201);
    expect(imported.body.imported).toBe(3);
    expect(imported.body.received).toBe(1);
    expect(imported.body.pagesFetched).toBe(1);
    expect(imported.body.reset).toEqual({
      pairsDeleted: 2,
      attendanceDeleted: 3,
      itemsUnassigned: 3
    });

    const pairs = await request(app).get("/api/sessions/YE2026-MY-001/pairs");
    expect(pairs.status).toBe(200);
    expect(pairs.body).toHaveLength(0);

    const attendance = await request(app).get("/api/sessions/YE2026-MY-001/attendance");
    expect(attendance.status).toBe(200);
    expect(attendance.body).toHaveLength(0);

    const items = await request(app).get("/api/sessions/YE2026-MY-001/items");
    expect(items.status).toBe(200);
    expect(items.body.every((row: { assignedPair?: string; assignedTo?: string | null }) => !row.assignedPair && !row.assignedTo)).toBe(true);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.test/sap-users");
    const payload = JSON.parse(String(init.body));
    expect(payload.sessionId).toBe("YE2026-MY-001");
    expect(payload.limit).toBe(1000);
    expect(payload.offset).toBe(0);
    expect(payload.page).toBe(1);
  });

  it("imports users from PA_USERS_URL across pages", async () => {
    process.env.PA_USERS_URL = "https://example.test/sap-users";
    process.env.PA_USERS_PAGE_SIZE = "2";
    process.env.PA_USERS_MAX_PAGES = "10";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              { id: "U-NEW-11", display_name: "New User 11", email_address: "u11@example.com" },
              { id: "U-NEW-12", display_name: "New User 12", email_address: "u12@example.com" }
            ],
            hasMore: true,
            nextOffset: 2
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ id: "U-NEW-13", display_name: "New User 13", email_address: "u13@example.com" }],
            hasMore: false
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const imported = await request(app).post("/api/users/import-from-pa").send({});

    expect(imported.status).toBe(201);
    expect(imported.body.received).toBe(3);
    expect(imported.body.imported).toBe(5);
    expect(imported.body.pagesFetched).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [, firstInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const firstPayload = JSON.parse(String(firstInit.body));
    expect(firstPayload.limit).toBe(2);
    expect(firstPayload.offset).toBe(0);
    expect(firstPayload.page).toBe(1);

    const [, secondInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    const secondPayload = JSON.parse(String(secondInit.body));
    expect(secondPayload.offset).toBe(2);
    expect(secondPayload.page).toBe(2);
  });

  it("requires sessionId when users import requests resetSessionAssignments", async () => {
    const response = await request(app).post("/api/users/import-from-pa").send({
      resetSessionAssignments: true
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid request body");
    expect(response.body.details?.fieldErrors?.sessionId?.[0]).toContain("sessionId is required");
  });

  it("imports SAP pages beyond 1000 rows and passes API key headers", async () => {
    process.env.PA_ITEMS_URL = "https://example.test/sap-items";
    process.env.API_KEY = "sap-test-key";
    process.env.PA_ITEMS_PAGE_SIZE = "1000";
    process.env.PA_ITEMS_MAX_PAGES = "10";

    const firstPage = Array.from({ length: 1000 }, (_, index) => ({
      id: `SAP-1-${index + 1}`,
      item_code: `ITM-1-${index + 1}`,
      item_name: `Paged Item 1-${index + 1}`,
      item_location: "S-01",
      sap_qty: index + 1
    }));
    const secondPage = Array.from({ length: 250 }, (_, index) => ({
      id: `SAP-2-${index + 1}`,
      item_code: `ITM-2-${index + 1}`,
      item_name: `Paged Item 2-${index + 1}`,
      item_location: "S-02",
      sap_qty: index + 1
    }));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: firstPage, hasMore: true, nextOffset: 1000 }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: secondPage, hasMore: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const imported = await request(app).post("/api/sessions/CC2026-SG-001/items/import-from-sap").send({
      entity: "BMSG"
    });

    expect(imported.status).toBe(201);
    expect(imported.body.received).toBe(1250);
    expect(imported.body.imported).toBe(1250);
    expect(imported.body.pagesFetched).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [firstUrl, firstInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(firstUrl).toBe("https://example.test/sap-items");
    const firstHeaders = firstInit.headers as Record<string, string>;
    expect(firstHeaders["x-api-key"]).toBe("sap-test-key");
    expect(firstHeaders.apikey).toBe("sap-test-key");
    const firstPayload = JSON.parse(String(firstInit.body));
    expect(firstPayload.limit).toBe(1000);
    expect(firstPayload.offset).toBe(0);
    expect(firstPayload.page).toBe(1);

    const [, secondInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    const secondPayload = JSON.parse(String(secondInit.body));
    expect(secondPayload.offset).toBe(1000);
    expect(secondPayload.page).toBe(2);

    const items = await request(app).get("/api/sessions/CC2026-SG-001/items");
    expect(items.status).toBe(200);
    expect(items.body.length).toBe(1250);
  });
});
