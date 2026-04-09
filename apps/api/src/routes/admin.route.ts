import { Router } from "express";
import { z } from "zod";
import { AdminController } from "../controllers/admin.controller";
import { HttpError } from "../errors/http-error";
import { asyncHandler } from "../middleware/async-handler";
import { requireRole } from "../middleware/auth";
import { validateBody, validateParams, validateQuery } from "../middleware/validate";
import {
  bulkAssignSchema,
  approvalActionSchema,
  attendanceScanSchema,
  attendanceUpsertSchema,
  auditInsertSchema,
  createAdjustmentSchema,
  createPairSchema,
  createSessionSchema,
  historyQuerySchema,
  importFromPaSchema,
  importFromSapSchema,
  importUsersFromPaSchema,
  itemUpdateSchema,
  itemCountFlatUpdateSchema,
  itemCountUpdateSchema,
  itemsQuerySchema,
  newItemCreateSchema,
  newItemUpdateSchema,
  sessionDeleteSchema,
  sessionIdParamSchema,
  idParamSchema,
  userRoleUpdateSchema,
  updateSessionSchema,
  updatePairSchema
} from "../validation/schemas";

const pairFlatCreateSchema = createPairSchema.extend({
  sessionId: z.string().trim().min(1)
});

const approvalFlatSchema = z.object({
  sessionId: z.string().trim().min(1),
  reviewedBy: z.string().trim().min(1)
});

function readRequiredSessionId(query: { sessionId?: string }): string {
  if (!query.sessionId) {
    throw new HttpError(400, "sessionId query is required");
  }
  return query.sessionId;
}

function readRequiredParam(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  throw new HttpError(400, `${key} param is required`);
}

export function createAdminRouter(controller: AdminController): Router {
  const router = Router();

  router.get("/sessions", requireRole("Admin", "Super Admin", "User"), asyncHandler(controller.listSessions));
  router.post(
    "/sessions",
    requireRole("Admin", "Super Admin"),
    validateBody(createSessionSchema),
    asyncHandler(controller.createSession)
  );
  router.patch(
    "/sessions/:sessionId",
    requireRole("Admin", "Super Admin"),
    validateParams(sessionIdParamSchema),
    validateBody(updateSessionSchema),
    asyncHandler(controller.updateSession)
  );
  router.post(
    "/sessions/:sessionId/reopen",
    requireRole("Admin", "Super Admin"),
    validateParams(sessionIdParamSchema),
    asyncHandler(controller.reopenSession)
  );
  router.post(
    "/sessions/:sessionId/end",
    requireRole("Admin", "Super Admin"),
    validateParams(sessionIdParamSchema),
    asyncHandler(controller.endSession)
  );
  router.post(
    "/sessions/:sessionId/load-recount-items",
    requireRole("Admin", "Super Admin"),
    validateParams(sessionIdParamSchema),
    asyncHandler(controller.loadRecountItems)
  );
  router.post(
    "/sessions/:sessionId/toggle-visibility",
    requireRole("Admin", "Super Admin"),
    validateParams(sessionIdParamSchema),
    asyncHandler(controller.toggleSessionVisibility)
  );
  router.post(
    "/sessions/:sessionId/toggle-strict-roles",
    requireRole("Admin", "Super Admin"),
    validateParams(sessionIdParamSchema),
    asyncHandler(controller.toggleStrictRoles)
  );
  router.delete(
    "/sessions/:sessionId",
    requireRole("Admin", "Super Admin"),
    validateParams(sessionIdParamSchema),
    validateBody(sessionDeleteSchema.partial()),
    asyncHandler(controller.deleteSession)
  );
  router.get(
    "/sessions/:sessionId",
    requireRole("Admin", "Super Admin"),
    validateParams(sessionIdParamSchema),
    asyncHandler(controller.getSession)
  );

  router.get(
    "/sessions/:sessionId/pairs",
    requireRole("Admin", "Super Admin"),
    validateParams(sessionIdParamSchema),
    asyncHandler(controller.listPairs)
  );
  router.post(
    "/sessions/:sessionId/pairs",
    requireRole("Admin", "Super Admin"),
    validateParams(sessionIdParamSchema),
    validateBody(createPairSchema),
    asyncHandler(controller.createPair)
  );

  router.get(
    "/sessions/:sessionId/attendance",
    requireRole("Admin", "Super Admin"),
    validateParams(sessionIdParamSchema),
    asyncHandler(controller.listAttendance)
  );
  router.patch(
    "/sessions/:sessionId/attendance/:userId/toggle",
    requireRole("Admin", "Super Admin"),
    asyncHandler(controller.toggleAttendance)
  );

  router.get(
    "/sessions/:sessionId/items",
    requireRole("Admin", "Super Admin", "User"),
    validateParams(sessionIdParamSchema),
    asyncHandler(controller.listItems)
  );
  router.patch(
    "/sessions/:sessionId/items/:itemId/count",
    requireRole("Admin", "Super Admin"),
    validateBody(itemCountUpdateSchema),
    asyncHandler(controller.updateItemCount)
  );
  router.patch(
    "/sessions/:sessionId/items/:itemId",
    requireRole("Admin", "Super Admin"),
    validateBody(itemUpdateSchema),
    asyncHandler(controller.updateItem)
  );
  router.post(
    "/sessions/:sessionId/items/bulk-assign",
    requireRole("Admin", "Super Admin"),
    validateParams(sessionIdParamSchema),
    validateBody(bulkAssignSchema),
    asyncHandler(controller.bulkAssignItems)
  );
  router.post(
    "/bins/import-from-pa",
    requireRole("Admin", "Super Admin"),
    validateBody(importFromPaSchema),
    asyncHandler(controller.importBinsFromPa)
  );

  router.post(
    "/users/import-from-pa",
    requireRole("Admin", "Super Admin"),
    validateBody(importUsersFromPaSchema),
    asyncHandler(controller.importUsersFromPa)
  );

  router.post(
    "/sessions/:sessionId/items/import-from-sap",
    requireRole("Admin", "Super Admin"),
    validateParams(sessionIdParamSchema),
    validateBody(importFromSapSchema),
    asyncHandler(controller.importItemsFromSap)
  );

  router.get(
    "/sessions/:sessionId/dashboard",
    requireRole("Admin", "Super Admin"),
    validateParams(sessionIdParamSchema),
    asyncHandler(controller.getDashboard)
  );
  router.get(
    "/sessions/:sessionId/dashboard/details",
    requireRole("Admin", "Super Admin"),
    validateParams(sessionIdParamSchema),
    asyncHandler(controller.getDashboardDetails)
  );

  router.get(
    "/sessions/:sessionId/audit",
    requireRole("Admin", "Super Admin"),
    validateParams(sessionIdParamSchema),
    asyncHandler(controller.listAudit)
  );

  router.get(
    "/sessions/:sessionId/new-items",
    requireRole("Admin", "Super Admin"),
    validateParams(sessionIdParamSchema),
    asyncHandler(controller.listNewItems)
  );

  router.get(
    "/sessions/:sessionId/approvals",
    requireRole("Admin", "Super Admin"),
    validateParams(sessionIdParamSchema),
    asyncHandler(controller.listApprovals)
  );
  router.post(
    "/sessions/:sessionId/approvals/:approvalId/approve",
    requireRole("Admin", "Super Admin"),
    validateBody(approvalActionSchema.pick({ reviewedBy: true }).partial()),
    asyncHandler(controller.approve)
  );
  router.post(
    "/sessions/:sessionId/approvals/:approvalId/reject",
    requireRole("Admin", "Super Admin"),
    validateBody(approvalActionSchema.pick({ reviewedBy: true }).partial()),
    asyncHandler(controller.reject)
  );

  // Flat endpoints from the Section 2 contract
  router.get(
    "/pairs",
    requireRole("Admin", "Super Admin"),
    validateQuery(itemsQuerySchema),
    asyncHandler(async (request, response) => {
      const sessionId = readRequiredSessionId(request.query as { sessionId?: string });
      const rows = await controller.service.listPairs(sessionId);
      response.json(rows);
    })
  );
  router.post(
    "/pairs",
    requireRole("Admin", "Super Admin"),
    validateBody(pairFlatCreateSchema),
    asyncHandler(async (request, response) => {
      const body = request.body as z.infer<typeof pairFlatCreateSchema>;
      const row = await controller.service.createPair(body.sessionId, {
        counter: body.counter,
        checker: body.checker,
        counter2: body.counter2,
        warehouse: body.warehouse,
        role: body.role
      });
      response.status(201).json(row);
    })
  );
  router.put("/pairs/:id", requireRole("Admin", "Super Admin"), validateBody(updatePairSchema), asyncHandler(controller.updatePair));
  router.delete("/pairs/:id", requireRole("Admin", "Super Admin"), asyncHandler(controller.deletePair));

  router.get(
    "/attendance",
    requireRole("Admin", "Super Admin"),
    validateQuery(itemsQuerySchema),
    asyncHandler(async (request, response) => {
      const sessionId = readRequiredSessionId(request.query as { sessionId?: string });
      const rows = await controller.service.listAttendance(sessionId);
      response.json(rows);
    })
  );
  router.post("/attendance", requireRole("Admin", "Super Admin"), validateBody(attendanceUpsertSchema), asyncHandler(controller.upsertAttendance));
  router.put("/attendance", requireRole("Admin", "Super Admin"), validateBody(attendanceUpsertSchema), asyncHandler(controller.upsertAttendance));
  router.post(
    "/attendance/scan",
    requireRole("Admin", "Super Admin", "User"),
    validateBody(attendanceScanSchema),
    asyncHandler(controller.scanAttendance)
  );

  router.get("/items", requireRole("Admin", "Super Admin", "User"), validateQuery(itemsQuerySchema), asyncHandler(controller.listAllItems));
  router.put(
    "/items/:itemId/count",
    requireRole("Admin", "Super Admin"),
    validateBody(itemCountFlatUpdateSchema),
    asyncHandler(async (request, response) => {
      const body = request.body as z.infer<typeof itemCountFlatUpdateSchema>;
      const row = await controller.service.updateItemCount({
        sessionId: body.sessionId,
        itemId: readRequiredParam(request.params as Record<string, unknown>, "itemId"),
        countQty: body.countQty
      });
      response.json(row);
    })
  );

  router.get(
    "/audit",
    requireRole("Admin", "Super Admin"),
    validateQuery(itemsQuerySchema),
    asyncHandler(async (request, response) => {
      const sessionId = readRequiredSessionId(request.query as { sessionId?: string });
      const rows = await controller.service.listAudit(sessionId);
      response.json(rows);
    })
  );
  router.post("/audit", requireRole("Admin", "Super Admin", "User"), validateBody(auditInsertSchema), asyncHandler(controller.createAudit));

  router.get(
    "/new-items",
    requireRole("Admin", "Super Admin"),
    validateQuery(itemsQuerySchema),
    asyncHandler(async (request, response) => {
      const sessionId = readRequiredSessionId(request.query as { sessionId?: string });
      const rows = await controller.service.listNewItems(sessionId);
      response.json(rows);
    })
  );
  router.post("/new-items", requireRole("Admin", "Super Admin", "User"), validateBody(newItemCreateSchema), asyncHandler(controller.createNewItem));
  router.put("/new-items/:id", requireRole("Admin", "Super Admin"), validateBody(newItemUpdateSchema), asyncHandler(controller.updateNewItem));

  router.post(
    "/approvals/:id/approve",
    requireRole("Admin", "Super Admin"),
    validateBody(approvalFlatSchema),
    asyncHandler(async (request, response) => {
      const body = request.body as z.infer<typeof approvalFlatSchema>;
      const row = await controller.service.reviewApproval({
        sessionId: body.sessionId,
        approvalId: readRequiredParam(request.params as Record<string, unknown>, "id"),
        action: "Approved",
        reviewedBy: body.reviewedBy
      });
      response.json(row);
    })
  );
  router.post(
    "/approvals/:id/reject",
    requireRole("Admin", "Super Admin"),
    validateBody(approvalFlatSchema),
    asyncHandler(async (request, response) => {
      const body = request.body as z.infer<typeof approvalFlatSchema>;
      const row = await controller.service.reviewApproval({
        sessionId: body.sessionId,
        approvalId: readRequiredParam(request.params as Record<string, unknown>, "id"),
        action: "Rejected",
        reviewedBy: body.reviewedBy
      });
      response.json(row);
    })
  );

  router.post(
    "/adjustments",
    requireRole("Admin", "Super Admin", "User"),
    validateBody(createAdjustmentSchema),
    asyncHandler(controller.createAdjustment)
  );
  router.get(
    "/adjustments",
    requireRole("Admin", "Super Admin", "User"),
    asyncHandler(controller.listAdjustments)
  );

  router.get(
    "/history",
    requireRole("Admin", "Super Admin", "User"),
    validateQuery(historyQuerySchema),
    asyncHandler(controller.listCountHistory)
  );

  router.get("/users", requireRole("Admin", "Super Admin"), asyncHandler(controller.listUsers));
  router.patch(
    "/users/:id/role",
    requireRole("Admin", "Super Admin"),
    validateParams(idParamSchema),
    validateBody(userRoleUpdateSchema),
    asyncHandler(controller.updateUserRole)
  );

  return router;
}
