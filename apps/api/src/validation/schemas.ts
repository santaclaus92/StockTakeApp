import { z } from "zod";

const sessionTypeSchema = z.enum(["Year End", "Cycle Count"]);
const countrySchema = z.enum(["Malaysia", "Singapore"]);
const entitySchema = z.enum(["BMS", "BMSD", "BMSG"]);
const roleSchema = z.enum(["Admin", "User"]);
const fullRoleSchema = z.enum(["User", "Admin", "Super Admin"]);

export const authPrecheckSchema = z.object({
  email: z.string().trim().email()
});

export const authResolveSchema = z.object({
  email: z.string().trim().email().optional()
});

export const sessionIdParamSchema = z.object({
  sessionId: z.string().min(1)
});

export const idParamSchema = z.object({
  id: z.string().min(1)
});

export const createSessionSchema = z.object({
  name: z.string().trim().min(1),
  type: sessionTypeSchema,
  country: countrySchema,
  entity: entitySchema,
  startDate: z.string().date(),
  endDate: z.string().date(),
  isRecount: z.boolean().optional(),
  parentId: z.string().trim().min(1).nullable().optional(),
  userVisible: z.boolean().optional()
});

export const updateSessionSchema = createSessionSchema;

export const sessionDeleteSchema = z.object({
  deletedBy: z.string().trim().min(1).optional()
});

export const createPairSchema = z.object({
  counter: z.string().trim().min(1),
  checker: z.string().trim().min(1),
  counter2: z.string().trim().optional(),
  warehouse: z.string().trim().min(1),
  role: roleSchema
});

export const updatePairSchema = createPairSchema.extend({
  sessionId: z.string().trim().min(1)
});

export const attendanceUpsertSchema = z.object({
  sessionId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  attended: z.boolean(),
  checkIn: z.string().datetime().optional(),
  lunchOut: z.string().datetime().optional(),
  lunchIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional()
});

export const attendanceScanSchema = z.object({
  token: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  name: z.string().trim().min(1)
});

export const itemCountUpdateSchema = z.object({
  countQty: z.number().finite()
});

export const itemCountFlatUpdateSchema = z.object({
  sessionId: z.string().trim().min(1),
  countQty: z.number().finite()
});

export const itemUpdateSchema = z
  .object({
    countQty: z.number().finite().nullable().optional(),
    damagedQty: z.number().finite().nullable().optional(),
    expiredQty: z.number().finite().nullable().optional(),
    dropped: z.boolean().optional(),
    assignedPair: z.string().trim().nullable().optional(),
    assignedTo: z.string().trim().nullable().optional(),
    adminRemark: z.string().nullable().optional()
  })
  .refine(
    (value) =>
      value.countQty !== undefined ||
      value.damagedQty !== undefined ||
      value.expiredQty !== undefined ||
      value.dropped !== undefined ||
      value.assignedPair !== undefined ||
      value.assignedTo !== undefined ||
      value.adminRemark !== undefined,
    {
      message: "At least one updatable field is required"
    }
  );

export const bulkAssignSchema = z.object({
  itemIds: z.array(z.string().trim().min(1)).min(1),
  pairId: z.string().trim().nullable(),
  assignedTo: z.string().trim().nullable().optional()
});

export const itemsQuerySchema = z.object({
  sessionId: z.string().trim().optional()
});

export const historyQuerySchema = z.object({
  submittedBy: z.string().trim().optional(),
  sessionId: z.string().trim().optional()
});

export const auditInsertSchema = z.object({
  sessionId: z.string().trim().min(1),
  itemId: z.string().trim().min(1),
  itemCode: z.string().trim().min(1),
  itemName: z.string().trim().min(1),
  submittedBy: z.string().trim().min(1),
  qty: z.number().finite(),
  remark: z.string().trim().optional(),
  warehouse: z.string().trim().optional(),
  pairId: z.string().trim().optional()
});

export const newItemCreateSchema = z.object({
  sessionId: z.string().trim().min(1),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  warehouse: z.string().trim().optional(),
  uom: z.string().trim().min(1).optional(),
  batch: z.string().trim().min(1).optional(),
  qty: z.number().finite().nonnegative().nullable().optional(),
  damagedQty: z.number().finite().nonnegative().nullable().optional(),
  expiredQty: z.number().finite().nonnegative().nullable().optional(),
  remark: z.string().trim().optional(),
  photos: z.array(z.string().trim().min(1)).optional(),
  submittedBy: z.string().trim().min(1)
});

export const newItemUpdateSchema = z.object({
  status: z.enum(["Pending", "Approved", "Rejected"])
});

export const importFromSapSchema = z.object({
  entity: z.string().trim().optional(),
  data: z.array(z.record(z.string(), z.unknown())).optional(),
  limit: z.coerce.number().int().positive().max(5000).optional(),
  maxPages: z.coerce.number().int().positive().max(1000).optional()
});

export const importFromPaSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())).optional()
});

export const importUsersFromPaSchema = importFromPaSchema
  .extend({
    sessionId: z.string().trim().min(1).optional(),
    resetSessionAssignments: z.boolean().optional()
  })
  .superRefine((value, context) => {
    if (value.resetSessionAssignments && !value.sessionId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sessionId"],
        message: "sessionId is required when resetSessionAssignments is true"
      });
    }
  });

export const approvalActionSchema = z.object({
  sessionId: z.string().trim().min(1),
  action: z.enum(["Approved", "Rejected"]),
  reviewedBy: z.string().trim().min(1)
});

export const warehouseSearchSchema = z.object({
  query: z.string().default(""),
  sessionId: z.string().trim().optional()
});

export const warehouseAssignedSchema = z.object({
  assignee: z.string().trim().optional(),
  userName: z.string().trim().optional(),
  sessionId: z.string().trim().optional()
});

export const countSubmissionSchema = z.object({
  itemId: z.string().trim().min(1),
  qty: z.number().finite(),
  submittedBy: z.string().trim().min(1),
  damagedQty: z.number().finite().nullable().optional(),
  expiredQty: z.number().finite().nullable().optional(),
  remark: z.string().trim().optional(),
  photos: z.array(z.string().trim().min(1)).optional(),
  binLocation: z.string().trim().optional()
});

export const userRoleUpdateSchema = z.object({
  role: fullRoleSchema
});

export const webhookImportBinsSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown()))
});

export const webhookImportUsersSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown()))
});

export const webhookImportItemsSchema = z.object({
  sessionId: z.string().trim().min(1),
  entity: z.string().trim().optional(),
  data: z.array(z.record(z.string(), z.unknown()))
});

export type CreateSessionBody = z.infer<typeof createSessionSchema>;
export type AuthPrecheckBody = z.infer<typeof authPrecheckSchema>;
export type AuthResolveBody = z.infer<typeof authResolveSchema>;
export type UpdateSessionBody = z.infer<typeof updateSessionSchema>;
export type CreatePairBody = z.infer<typeof createPairSchema>;
export type UpdatePairBody = z.infer<typeof updatePairSchema>;
export type AttendanceUpsertBody = z.infer<typeof attendanceUpsertSchema>;
export type AttendanceScanBody = z.infer<typeof attendanceScanSchema>;
export type ItemCountUpdateBody = z.infer<typeof itemCountUpdateSchema>;
export type ItemUpdateBody = z.infer<typeof itemUpdateSchema>;
export type BulkAssignBody = z.infer<typeof bulkAssignSchema>;
export type AuditInsertBody = z.infer<typeof auditInsertSchema>;
export type NewItemCreateBody = z.infer<typeof newItemCreateSchema>;
export type NewItemUpdateBody = z.infer<typeof newItemUpdateSchema>;
export type ImportFromSapBody = z.infer<typeof importFromSapSchema>;
export type ImportFromPaBody = z.infer<typeof importFromPaSchema>;
export type ImportUsersFromPaBody = z.infer<typeof importUsersFromPaSchema>;
export type ApprovalActionBody = z.infer<typeof approvalActionSchema>;
export type CountSubmissionBody = z.infer<typeof countSubmissionSchema>;
export type SessionDeleteBody = z.infer<typeof sessionDeleteSchema>;
export type UserRoleUpdateBody = z.infer<typeof userRoleUpdateSchema>;
export type WebhookImportBinsBody = z.infer<typeof webhookImportBinsSchema>;
export type WebhookImportUsersBody = z.infer<typeof webhookImportUsersSchema>;
export type WebhookImportItemsBody = z.infer<typeof webhookImportItemsSchema>;
