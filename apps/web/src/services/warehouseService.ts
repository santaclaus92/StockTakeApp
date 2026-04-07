import { apiClient, useMockServices } from "./apiClient";
import { mockStore } from "./mockStore";
import type { CountSubmissionInput, WarehouseItem } from "../types/domain";

export const warehouseService = {
  getBins(): Promise<string[]> {
    if (useMockServices) return Promise.resolve([]);
    return apiClient.get<string[]>("/warehouse/bins");
  },

  getWhCodes(sessionId?: string): Promise<string[]> {
    if (useMockServices) return Promise.resolve([]);
    const params = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
    return apiClient.get<string[]>(`/warehouse/wh-codes${params}`);
  },

  searchItems(query: string, sessionId?: string): Promise<WarehouseItem[]> {
    if (useMockServices) return mockStore.searchWarehouseItems(query);
    const params = new URLSearchParams({ query });
    if (sessionId) params.set("sessionId", sessionId);
    return apiClient.get<WarehouseItem[]>(`/warehouse/items?${params.toString()}`);
  },

  listAssignedItems(input?: { assignee?: string; sessionId?: string; userName?: string }): Promise<WarehouseItem[]> {
    if (useMockServices) return mockStore.listAssignedItems(input?.assignee, input?.sessionId, input?.userName);
    const params = new URLSearchParams();
    if (input?.assignee?.trim()) params.set("assignee", input.assignee.trim());
    if (input?.userName?.trim()) params.set("userName", input.userName.trim());
    if (input?.sessionId) params.set("sessionId", input.sessionId);
    return apiClient.get<WarehouseItem[]>(`/warehouse/assigned?${params.toString()}`);
  },

  submitCount(input: CountSubmissionInput): Promise<void> {
    if (useMockServices) return mockStore.submitCount(input);
    return apiClient.post<void>("/warehouse/counts", input);
  }
};
