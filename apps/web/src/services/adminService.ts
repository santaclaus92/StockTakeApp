import { apiClient, useMockServices } from "./apiClient";
import { mockStore } from "./mockStore";
import { getSupabaseAuthClient } from "./supabaseAuth";
import type {
  ApprovalRecord,
  AttendanceScanResult,
  AttendanceRecord,
  AuditEntry,
  BulkAssignInput,
  CountHistoryEntry,
  DashboardDetails,
  DashboardSummary,
  ImportRowsResult,
  ImportUsersResult,
  ItemMasterItem,
  ItemUpdateInput,
  NewItemCreateInput,
  NewItemRecord,
  NewSessionInput,
  PairAssignment,
  Session,
  UserRoleRecord
} from "../types/domain";

export const adminService = {
  listSessions(): Promise<Session[]> {
    if (useMockServices) return mockStore.listSessions();
    return apiClient.get<Session[]>("/sessions");
  },

  createSession(input: NewSessionInput): Promise<Session> {
    if (useMockServices) return mockStore.createSession(input);
    return apiClient.post<Session>("/sessions", input);
  },

  updateSession(sessionId: string, input: NewSessionInput): Promise<Session | null> {
    if (useMockServices) return mockStore.updateSession(sessionId, input);
    return apiClient.patch<Session>(`/sessions/${sessionId}`, input);
  },

  reopenSession(sessionId: string): Promise<Session | null> {
    if (useMockServices) return mockStore.reopenSession(sessionId);
    return apiClient.post<Session>(`/sessions/${sessionId}/reopen`, {});
  },

  endSession(sessionId: string): Promise<Session | null> {
    if (useMockServices) return mockStore.endSession(sessionId);
    return apiClient.post<Session>(`/sessions/${sessionId}/end`, {});
  },

  toggleSessionVisibility(sessionId: string): Promise<Session | null> {
    if (useMockServices) return mockStore.toggleSessionVisibility(sessionId);
    return apiClient.post<Session>(`/sessions/${sessionId}/toggle-visibility`, {});
  },

  toggleStrictRoles(sessionId: string): Promise<Session | null> {
    if (useMockServices) return mockStore.toggleStrictRoles(sessionId);
    return apiClient.post<Session>(`/sessions/${sessionId}/toggle-strict-roles`, {});
  },

  async deleteSession(sessionId: string, deletedBy?: string): Promise<boolean> {
    if (useMockServices) return mockStore.deleteSession(sessionId);
    const payload = deletedBy ? { deletedBy } : undefined;
    const response = await apiClient.delete<{ deleted: boolean }>(`/sessions/${sessionId}`, payload);
    return response.deleted;
  },

  getSession(sessionId: string): Promise<Session | null> {
    if (useMockServices) return mockStore.getSession(sessionId);
    return apiClient.get<Session>(`/sessions/${sessionId}`);
  },

  listPairs(sessionId: string): Promise<PairAssignment[]> {
    if (useMockServices) return mockStore.listPairs(sessionId);
    return apiClient.get<PairAssignment[]>(`/sessions/${sessionId}/pairs`);
  },

  createPair(sessionId: string, input: Omit<PairAssignment, "id">): Promise<PairAssignment> {
    if (useMockServices) return mockStore.createPair(sessionId, input);
    return apiClient.post<PairAssignment>(`/sessions/${sessionId}/pairs`, input);
  },

  updatePair(pairId: string, sessionId: string, input: Omit<PairAssignment, "id">): Promise<PairAssignment | null> {
    if (useMockServices) return mockStore.updatePair(pairId, sessionId, input);
    return apiClient.put<PairAssignment>(`/pairs/${pairId}`, { ...input, sessionId });
  },

  async deletePair(pairId: string): Promise<boolean> {
    if (useMockServices) return mockStore.deletePair(pairId);
    const response = await apiClient.delete<{ deleted: boolean }>(`/pairs/${pairId}`);
    return response.deleted;
  },

  listAttendance(sessionId: string): Promise<AttendanceRecord[]> {
    if (useMockServices) return mockStore.listAttendance(sessionId);
    return apiClient.get<AttendanceRecord[]>(`/sessions/${sessionId}/attendance`);
  },

  upsertAttendance(input: AttendanceRecord & { sessionId: string }): Promise<AttendanceRecord> {
    if (useMockServices) return mockStore.upsertAttendance(input);
    return apiClient.post<AttendanceRecord>("/attendance", input);
  },

  toggleAttendance(sessionId: string, userId: string): Promise<AttendanceRecord | null> {
    if (useMockServices) return mockStore.toggleAttendance(sessionId, userId);
    return apiClient.patch<AttendanceRecord>(`/sessions/${sessionId}/attendance/${userId}/toggle`);
  },

  listItems(sessionId: string): Promise<ItemMasterItem[]> {
    if (useMockServices) return mockStore.listItems(sessionId);
    return apiClient.get<ItemMasterItem[]>(`/sessions/${sessionId}/items`);
  },

  importItemsFromSap(
    sessionId: string,
    input?: {
      entity?: string;
      data?: Record<string, unknown>[];
    }
  ): Promise<{ imported: number; received: number }> {
    if (useMockServices) return mockStore.importItemsFromSap({ sessionId, ...input });
    return apiClient.post<{ imported: number; received: number }>(`/sessions/${sessionId}/items/import-from-sap`, input ?? {});
  },

  importBinsFromPa(input?: { data?: Record<string, unknown>[] }): Promise<ImportRowsResult> {
    if (useMockServices) return mockStore.importBinsFromPa(input);
    return apiClient.post<ImportRowsResult>("/bins/import-from-pa", input ?? {});
  },

  importUsersFromPa(input?: {
    sessionId?: string;
    resetSessionAssignments?: boolean;
    data?: Record<string, unknown>[];
  }): Promise<ImportUsersResult> {
    if (useMockServices) return mockStore.importUsersFromPa(input);
    return apiClient.post<ImportUsersResult>("/users/import-from-pa", input ?? {});
  },

  updateItemCount(sessionId: string, itemId: string, countQty: number): Promise<ItemMasterItem | null> {
    if (useMockServices) return mockStore.updateItemCount(sessionId, itemId, countQty);
    return apiClient.patch<ItemMasterItem>(`/sessions/${sessionId}/items/${itemId}/count`, { countQty });
  },

  updateItem(input: ItemUpdateInput): Promise<ItemMasterItem | null> {
    if (useMockServices) return mockStore.updateItem(input);
    return apiClient.patch<ItemMasterItem>(`/sessions/${input.sessionId}/items/${input.itemId}`, {
      countQty: input.countQty,
      damagedQty: input.damagedQty,
      expiredQty: input.expiredQty,
      dropped: input.dropped,
      assignedPair: input.assignedPair,
      assignedTo: input.assignedTo,
      adminRemark: input.adminRemark
    });
  },

  bulkAssignItems(input: BulkAssignInput): Promise<{ updated: number }> {
    if (useMockServices) return mockStore.bulkAssignItems(input);
    return apiClient.post<{ updated: number }>(`/sessions/${input.sessionId}/items/bulk-assign`, {
      itemIds: input.itemIds,
      pairId: input.pairId,
      assignedTo: input.assignedTo
    });
  },

  getDashboard(sessionId: string): Promise<DashboardSummary> {
    if (useMockServices) return mockStore.getDashboard(sessionId);
    return apiClient.get<DashboardSummary>(`/sessions/${sessionId}/dashboard`);
  },

  getDashboardDetails(sessionId: string): Promise<DashboardDetails> {
    if (useMockServices) return mockStore.getDashboardDetails(sessionId);
    return apiClient.get<DashboardDetails>(`/sessions/${sessionId}/dashboard/details`);
  },

  listAudit(sessionId: string): Promise<AuditEntry[]> {
    if (useMockServices) return mockStore.listAudit(sessionId);
    return apiClient.get<AuditEntry[]>(`/sessions/${sessionId}/audit`);
  },

  listNewItems(sessionId: string): Promise<NewItemRecord[]> {
    if (useMockServices) return mockStore.listNewItems(sessionId);
    return apiClient.get<NewItemRecord[]>(`/sessions/${sessionId}/new-items`);
  },

  updateNewItemStatus(itemId: string, status: NewItemRecord["status"]): Promise<NewItemRecord | null> {
    if (useMockServices) return mockStore.updateNewItemStatus(itemId, status);
    return apiClient.put<NewItemRecord>(`/new-items/${itemId}`, { status });
  },

  createNewItem(sessionId: string, input: NewItemCreateInput) {
    if (useMockServices) return mockStore.createNewItem({ sessionId, ...input });
    return apiClient.post<NewItemRecord>("/new-items", { sessionId, ...input });
  },

  listApprovals(sessionId: string): Promise<ApprovalRecord[]> {
    if (useMockServices) return mockStore.listApprovals(sessionId);
    return apiClient.get<ApprovalRecord[]>(`/sessions/${sessionId}/approvals`);
  },

  reviewApproval(sessionId: string, approvalId: string, status: "Approved" | "Rejected"): Promise<ApprovalRecord | null> {
    if (useMockServices) return mockStore.reviewApproval(sessionId, approvalId, status);
    const actionPath = status === "Approved" ? "approve" : "reject";
    return apiClient.post<ApprovalRecord>(`/sessions/${sessionId}/approvals/${approvalId}/${actionPath}`, {});
  },

  listCountHistory(filters?: { submittedBy?: string; sessionId?: string }): Promise<CountHistoryEntry[]> {
    if (useMockServices) return mockStore.listCountHistory(filters?.submittedBy, filters?.sessionId);
    const params = new URLSearchParams();
    if (filters?.submittedBy) params.set("submittedBy", filters.submittedBy);
    if (filters?.sessionId) params.set("sessionId", filters.sessionId);
    const query = params.toString() ? `?${params.toString()}` : "";
    return apiClient.get<CountHistoryEntry[]>(`/history${query}`);
  },

  listUsers(): Promise<UserRoleRecord[]> {
    if (useMockServices) return mockStore.listUsers();
    return apiClient.get<UserRoleRecord[]>("/users");
  },

  async updateUserRole(userId: string, role: UserRoleRecord["role"]): Promise<UserRoleRecord | null> {
    if (useMockServices) return mockStore.updateUserRole(userId, role);
    const supabase = getSupabaseAuthClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("users")
        .update({ role })
        .eq("id", userId)
        .select()
        .single();
      if (!error && data) {
        return data as UserRoleRecord;
      }
      console.warn("Direct Supabase role update failed, falling back to API client", error);
    }
    return apiClient.patch<UserRoleRecord>(`/users/${userId}/role`, { role });
  },

  scanAttendance(input: { token: string; userId: string; name: string }): Promise<AttendanceScanResult> {
    if (useMockServices) return mockStore.scanAttendance(input);
    return apiClient.post<AttendanceScanResult>("/attendance/scan", input);
  }
};
