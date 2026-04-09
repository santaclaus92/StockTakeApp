import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminService } from "../services/adminService";
import type { BulkAssignInput, CreateAdjustmentInput, ItemUpdateInput, NewItemCreateInput, NewSessionInput, PairAssignment, UserRoleRecord } from "../types/domain";

type ImportBinsFromPaInput = {
  data?: Record<string, unknown>[];
};

type ImportUsersFromPaInput = {
  sessionId?: string;
  resetSessionAssignments?: boolean;
  data?: Record<string, unknown>[];
};

function invalidateSessionQueryCache(queryClient: ReturnType<typeof useQueryClient>, sessionId: string) {
  queryClient.invalidateQueries({ queryKey: ["sessions"] });
  queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
}

function invalidateSessionData(queryClient: ReturnType<typeof useQueryClient>, sessionId: string) {
  queryClient.invalidateQueries({ queryKey: ["pairs", sessionId] });
  queryClient.invalidateQueries({ queryKey: ["attendance", sessionId] });
  queryClient.invalidateQueries({ queryKey: ["items", sessionId] });
  queryClient.invalidateQueries({ queryKey: ["dashboard", sessionId] });
  queryClient.invalidateQueries({ queryKey: ["dashboard-details", sessionId] });
  queryClient.invalidateQueries({ queryKey: ["audit", sessionId] });
  queryClient.invalidateQueries({ queryKey: ["new-items", sessionId] });
  queryClient.invalidateQueries({ queryKey: ["approvals", sessionId] });
}

export function useSessionsQuery() {
  return useQuery({
    queryKey: ["sessions"],
    queryFn: adminService.listSessions
  });
}

export function useCreateSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewSessionInput) => adminService.createSession(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    }
  });
}

export function useUpdateSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, input }: { sessionId: string; input: NewSessionInput }) =>
      adminService.updateSession(sessionId, input),
    onSuccess: (_data, variables) => {
      invalidateSessionQueryCache(queryClient, variables.sessionId);
    }
  });
}

export function useReopenSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => adminService.reopenSession(sessionId),
    onSuccess: (_data, sessionId) => {
      invalidateSessionQueryCache(queryClient, sessionId);
    }
  });
}

export function useEndSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => adminService.endSession(sessionId),
    onSuccess: (_data, sessionId) => {
      invalidateSessionQueryCache(queryClient, sessionId);
    }
  });
}

export function useLoadRecountItemsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => adminService.loadRecountItems(sessionId),
    onSuccess: (_data, sessionId) => {
      void queryClient.invalidateQueries({ queryKey: ["items", sessionId] });
    }
  });
}

export function useToggleSessionVisibilityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => adminService.toggleSessionVisibility(sessionId),
    onSuccess: (_data, sessionId) => {
      invalidateSessionQueryCache(queryClient, sessionId);
    }
  });
}

export function useToggleStrictRolesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => adminService.toggleStrictRoles(sessionId),
    onSuccess: (_data, sessionId) => {
      invalidateSessionQueryCache(queryClient, sessionId);
    }
  });
}

export function useDeleteSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, deletedBy }: { sessionId: string; deletedBy?: string }) =>
      adminService.deleteSession(sessionId, deletedBy),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.removeQueries({ queryKey: ["session", variables.sessionId] });
      queryClient.removeQueries({ queryKey: ["pairs", variables.sessionId] });
      queryClient.removeQueries({ queryKey: ["attendance", variables.sessionId] });
      queryClient.removeQueries({ queryKey: ["items", variables.sessionId] });
      queryClient.removeQueries({ queryKey: ["dashboard", variables.sessionId] });
      queryClient.removeQueries({ queryKey: ["audit", variables.sessionId] });
      queryClient.removeQueries({ queryKey: ["new-items", variables.sessionId] });
      queryClient.removeQueries({ queryKey: ["approvals", variables.sessionId] });
    }
  });
}

export function useSessionQuery(sessionId: string) {
  return useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => adminService.getSession(sessionId),
    enabled: Boolean(sessionId)
  });
}

export function usePairsQuery(sessionId: string) {
  return useQuery({
    queryKey: ["pairs", sessionId],
    queryFn: () => adminService.listPairs(sessionId),
    enabled: Boolean(sessionId)
  });
}

export function useCreatePairMutation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<PairAssignment, "id">) => adminService.createPair(sessionId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pairs", sessionId] })
  });
}

export function useUpdatePairMutation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pairId, input }: { pairId: string; input: Omit<PairAssignment, "id"> }) =>
      adminService.updatePair(pairId, sessionId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pairs", sessionId] })
  });
}

export function useDeletePairMutation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pairId: string) => adminService.deletePair(pairId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pairs", sessionId] })
  });
}

export function useAttendanceQuery(sessionId: string) {
  return useQuery({
    queryKey: ["attendance", sessionId],
    queryFn: () => adminService.listAttendance(sessionId),
    enabled: Boolean(sessionId)
  });
}

export function useToggleAttendanceMutation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminService.toggleAttendance(sessionId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance", sessionId] })
  });
}

export function useUpsertAttendanceMutation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      userId: string;
      name: string;
      attended: boolean;
      checkIn?: string;
      lunchOut?: string;
      lunchIn?: string;
      checkOut?: string;
    }) =>
      adminService.upsertAttendance({ sessionId, ...input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance", sessionId] })
  });
}

export function useItemsQuery(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: ["items", sessionId],
    queryFn: () => adminService.listItems(sessionId),
    enabled: Boolean(sessionId) && enabled
  });
}

export function useImportItemsFromSapMutation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input?: { entity?: string; data?: Record<string, unknown>[] }) =>
      adminService.importItemsFromSap(sessionId, input),
    onSuccess: () => {
      invalidateSessionData(queryClient, sessionId);
      queryClient.invalidateQueries({ queryKey: ["warehouse-search"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-assigned"] });
    }
  });
}

export function useUpdateItemCountMutation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, countQty }: { itemId: string; countQty: number }) =>
      adminService.updateItemCount(sessionId, itemId, countQty),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["audit", sessionId] });
    }
  });
}

export function useUpdateItemMutation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ItemUpdateInput, "sessionId">) => adminService.updateItem({ sessionId, ...input }),
    onSuccess: () => {
      invalidateSessionData(queryClient, sessionId);
    }
  });
}

export function useBulkAssignItemsMutation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<BulkAssignInput, "sessionId">) => adminService.bulkAssignItems({ sessionId, ...input }),
    onSuccess: () => {
      invalidateSessionData(queryClient, sessionId);
      queryClient.invalidateQueries({ queryKey: ["warehouse-search"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-assigned"] });
    }
  });
}

export function useDashboardQuery(sessionId: string) {
  return useQuery({
    queryKey: ["dashboard", sessionId],
    queryFn: () => adminService.getDashboard(sessionId),
    enabled: Boolean(sessionId)
  });
}

export function useAuditQuery(sessionId: string) {
  return useQuery({
    queryKey: ["audit", sessionId],
    queryFn: () => adminService.listAudit(sessionId),
    enabled: Boolean(sessionId)
  });
}

export function useDashboardDetailsQuery(sessionId: string) {
  return useQuery({
    queryKey: ["dashboard-details", sessionId],
    queryFn: () => adminService.getDashboardDetails(sessionId),
    enabled: Boolean(sessionId)
  });
}

export function useNewItemsQuery(sessionId: string) {
  return useQuery({
    queryKey: ["new-items", sessionId],
    queryFn: () => adminService.listNewItems(sessionId),
    enabled: Boolean(sessionId)
  });
}

export function useCreateNewItemMutation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewItemCreateInput) => adminService.createNewItem(sessionId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["new-items", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["items", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-search"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-assigned"] });
    }
  });
}

export function useUpdateNewItemStatusMutation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: "Pending" | "Approved" | "Rejected" }) =>
      adminService.updateNewItemStatus(itemId, status),
    onSuccess: () => {
      invalidateSessionData(queryClient, sessionId);
    }
  });
}

export function useApprovalsQuery(sessionId: string) {
  return useQuery({
    queryKey: ["approvals", sessionId],
    queryFn: () => adminService.listApprovals(sessionId),
    enabled: Boolean(sessionId)
  });
}

export function useReviewApprovalMutation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ approvalId, status }: { approvalId: string; status: "Approved" | "Rejected" }) =>
      adminService.reviewApproval(sessionId, approvalId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["approvals", sessionId] })
  });
}

export function useCreateAdjustmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAdjustmentInput) => adminService.createAdjustment(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["my-adjustments", variables.sessionId] });
    }
  });
}

export function useMyAdjustmentsQuery(sessionId?: string, submittedBy?: string) {
  return useQuery({
    queryKey: ["my-adjustments", sessionId ?? "", submittedBy ?? ""],
    queryFn: () => adminService.listMyAdjustments({ sessionId, submittedBy }),
    enabled: Boolean(sessionId)
  });
}

export function useCountHistoryQuery(filters?: { submittedBy?: string; sessionId?: string }) {
  return useQuery({
    queryKey: ["count-history", filters?.submittedBy ?? "", filters?.sessionId ?? ""],
    queryFn: () => adminService.listCountHistory(filters)
  });
}

export function useUsersQuery() {
  return useQuery({
    queryKey: ["users"],
    queryFn: adminService.listUsers
  });
}

export function useImportBinsFromPaMutation(sessionId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input?: ImportBinsFromPaInput) => adminService.importBinsFromPa(input),
    onSuccess: () => {
      if (sessionId) {
        invalidateSessionData(queryClient, sessionId);
      }
      queryClient.invalidateQueries({ queryKey: ["warehouse-search"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-assigned"] });
    }
  });
}

export function useImportUsersFromPaMutation(sessionId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input?: ImportUsersFromPaInput) =>
      adminService.importUsersFromPa({
        sessionId: input?.sessionId ?? sessionId,
        resetSessionAssignments: input?.resetSessionAssignments,
        data: input?.data
      }),
    onSuccess: (_result, input) => {
      const targetSessionId = input?.sessionId ?? sessionId;
      queryClient.invalidateQueries({ queryKey: ["users"] });
      if (targetSessionId) {
        invalidateSessionData(queryClient, targetSessionId);
      }
    }
  });
}

export function useUpdateUserRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRoleRecord["role"] }) =>
      adminService.updateUserRole(userId, role),
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<UserRoleRecord[]>(["users"], (old) =>
        old?.map((u) => (u.id === variables.userId ? { ...u, role: variables.role } : u)) ?? []
      );
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });
}

export function useScanAttendanceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { token: string; userId: string; name: string }) => adminService.scanAttendance(input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["attendance", result.sessionId] });
      (result.affectedSessionIds ?? []).forEach((sessionId) => {
        queryClient.invalidateQueries({ queryKey: ["attendance", sessionId] });
      });
    }
  });
}
