import type {
  ApprovalActionInput,
  ApprovalRecord,
  BulkAssignInput,
  CountHistoryEntry,
  AttendanceRecord,
  AttendanceUpsertInput,
  AuditEntry,
  AuditInsertInput,
  CountSubmissionInput,
  DashboardDetails,
  DashboardSummary,
  ItemUpdateInput,
  ItemCountUpdateInput,
  ItemMasterItem,
  NewItemInput,
  NewItemRecord,
  NewSessionInput,
  PairAssignment,
  PairInput,
  PairUpdateInput,
  SessionAssignmentResetResult,
  Session,
  UserRoleRecord,
  WarehouseItem,
  WebhookImportPayload
} from "../domain/types";

export interface StaRepository {
  listSessions(): Promise<Session[]>;
  createSession(input: NewSessionInput): Promise<Session>;
  getSession(sessionId: string): Promise<Session | null>;
  updateSession(sessionId: string, input: NewSessionInput): Promise<Session | null>;
  reopenSession(sessionId: string): Promise<Session | null>;
  endSession(sessionId: string): Promise<Session | null>;
  toggleSessionVisibility(sessionId: string): Promise<Session | null>;
  toggleStrictRoles(sessionId: string): Promise<Session | null>;
  deleteSession(sessionId: string, deletedBy: string): Promise<boolean>;

  listPairs(sessionId: string): Promise<PairAssignment[]>;
  createPair(sessionId: string, input: PairInput): Promise<PairAssignment>;
  updatePair(pairId: string, input: PairUpdateInput): Promise<PairAssignment | null>;
  deletePair(pairId: string): Promise<boolean>;

  listAttendance(sessionId: string): Promise<AttendanceRecord[]>;
  upsertAttendance(input: AttendanceUpsertInput): Promise<AttendanceRecord>;
  toggleAttendance(sessionId: string, userId: string): Promise<AttendanceRecord | null>;

  listItems(sessionId: string): Promise<ItemMasterItem[]>;
  getItemById(itemId: string): Promise<ItemMasterItem | null>;
  updateItemCount(input: ItemCountUpdateInput): Promise<ItemMasterItem | null>;
  updateItem(input: ItemUpdateInput): Promise<ItemMasterItem | null>;
  bulkAssignItems(input: BulkAssignInput): Promise<{ updated: number }>;

  getDashboard(sessionId: string): Promise<DashboardSummary>;
  getDashboardDetails(sessionId: string): Promise<DashboardDetails>;
  listAudit(sessionId: string): Promise<AuditEntry[]>;
  insertAudit(input: AuditInsertInput): Promise<AuditEntry>;

  listNewItems(sessionId: string): Promise<NewItemRecord[]>;
  createNewItem(input: NewItemInput): Promise<NewItemRecord>;
  updateNewItemStatus(itemId: string, status: NewItemRecord["status"]): Promise<NewItemRecord | null>;

  listApprovals(sessionId: string): Promise<ApprovalRecord[]>;
  actOnApproval(input: ApprovalActionInput): Promise<ApprovalRecord | null>;

  listBins(): Promise<string[]>;
  listWhCodes(sessionId?: string): Promise<string[]>;
  searchWarehouseItems(query: string, sessionId?: string): Promise<WarehouseItem[]>;
  listAssignedItems(input?: { assignee?: string; userName?: string }): Promise<WarehouseItem[]>;
  submitCount(input: CountSubmissionInput): Promise<void>;
  listCountHistory(filters?: { submittedBy?: string; sessionId?: string }): Promise<CountHistoryEntry[]>;
  listUsers(): Promise<UserRoleRecord[]>;
  findUserByEmail(email: string): Promise<UserRoleRecord | null>;
  updateUserRole(userId: string, role: UserRoleRecord["role"]): Promise<UserRoleRecord | null>;
  resetSessionAssignments(sessionId: string): Promise<SessionAssignmentResetResult>;

  importWebhookPayload(payload: WebhookImportPayload): Promise<{ imported: number }>;
}
