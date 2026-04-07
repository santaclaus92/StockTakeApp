import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { warehouseService } from "../services/warehouseService";
import type { CountSubmissionInput } from "../types/domain";

export function useBinsQuery(enabled = true) {
  return useQuery({
    queryKey: ["warehouse-bins"],
    queryFn: () => warehouseService.getBins(),
    enabled,
    staleTime: 5 * 60 * 1000
  });
}

export function useWhCodesQuery(sessionId?: string, enabled = true) {
  return useQuery({
    queryKey: ["warehouse-wh-codes", sessionId ?? ""],
    queryFn: () => warehouseService.getWhCodes(sessionId),
    enabled,
    staleTime: 5 * 60 * 1000
  });
}

export function useWarehouseSearchQuery(query: string) {
  return useQuery({
    queryKey: ["warehouse-search", query],
    queryFn: () => warehouseService.searchItems(query)
  });
}

export function useWarehouseSearchBySessionQuery(query: string, sessionId?: string, enabled = true) {
  return useQuery({
    queryKey: ["warehouse-search", query, sessionId ?? ""],
    queryFn: () => warehouseService.searchItems(query, sessionId),
    enabled
  });
}

export function useAssignedItemsQuery(assignee = "P-01") {
  return useQuery({
    queryKey: ["warehouse-assigned", assignee],
    queryFn: () => warehouseService.listAssignedItems({ assignee })
  });
}

export function useAssignedItemsBySessionQuery(
  assignee?: string,
  sessionId?: string,
  userName?: string,
  enabled = true
) {
  return useQuery({
    queryKey: ["warehouse-assigned", assignee ?? "", sessionId ?? "", userName ?? ""],
    queryFn: () => warehouseService.listAssignedItems({ assignee, sessionId, userName }),
    enabled
  });
}

export function useSubmitCountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CountSubmissionInput) => warehouseService.submitCount(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-search"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-assigned"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
    }
  });
}
