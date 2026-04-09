import { HttpError } from "../errors/http-error";
import type {
  ApprovalActionInput,
  AttendanceScanInput,
  AttendanceScanResult,
  AttendanceUpsertInput,
  AuditInsertInput,
  BulkAssignInput,
  CountSubmissionInput,
  ItemUpdateInput,
  ItemCountUpdateInput,
  NewItemInput,
  NewSessionInput,
  PairInput,
  PairUpdateInput,
  WebhookImportPayload
} from "../domain/types";
import type { StaRepository } from "../repositories/sta-repository";

function parseAttendanceToken(token: string): { sessionId: string; minute: number } | null {
  const trimmed = token.trim();
  const parts = trimmed.split(":");
  if (parts.length !== 3 || parts[0] !== "att") {
    return null;
  }
  const sessionId = parts[1]?.trim();
  const minute = Number(parts[2]);
  if (!sessionId || !Number.isFinite(minute)) {
    return null;
  }
  return {
    sessionId,
    minute: Math.floor(minute)
  };
}

function normalizeCountry(value: unknown): "Malaysia" | "Singapore" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "malaysia" || normalized === "my") return "Malaysia";
  if (normalized === "singapore" || normalized === "sg") return "Singapore";
  return null;
}

export class StaService {
  constructor(private readonly repository: StaRepository) {}

  listSessions() {
    return this.repository.listSessions();
  }

  createSession(input: NewSessionInput) {
    return this.repository.createSession(input);
  }

  async updateSession(sessionId: string, input: NewSessionInput) {
    const updated = await this.repository.updateSession(sessionId, input);
    if (!updated) {
      throw new HttpError(404, "Session not found");
    }
    return updated;
  }

  async reopenSession(sessionId: string) {
    const updated = await this.repository.reopenSession(sessionId);
    if (!updated) {
      throw new HttpError(404, "Session not found");
    }
    return updated;
  }

  async endSession(sessionId: string) {
    const updated = await this.repository.endSession(sessionId);
    if (!updated) {
      throw new HttpError(404, "Session not found");
    }

    // Load new items, variance, and not-found items into any linked recount session, then assign pairs
    if (!updated.isRecount) {
      try {
        const recountSessions = await this.repository.findLinkedRecountSessions(sessionId);
        for (const recount of recountSessions) {
          await this.repository.autoLoadItemsToRecountSession(sessionId, recount.id);
          await this.repository.autoAssignRecountItems(recount.id);
        }
      } catch (err) {
        // Non-fatal: auto-load failure should not block session end
        console.error("[endSession] recount item load/assign failed:", err);
      }
    }

    return updated;
  }

  async loadRecountItems(parentSessionId: string): Promise<{ loaded: number }> {
    const recountSessions = await this.repository.findLinkedRecountSessions(parentSessionId);
    if (recountSessions.length === 0) {
      throw new HttpError(404, "No linked recount session found for this session");
    }
    let total = 0;
    for (const recount of recountSessions) {
      total += await this.repository.autoLoadItemsToRecountSession(parentSessionId, recount.id);
      await this.repository.autoAssignRecountItems(recount.id);
    }
    return { loaded: total };
  }

  async toggleSessionVisibility(sessionId: string) {
    const existing = await this.repository.getSession(sessionId);
    if (!existing) {
      throw new HttpError(404, "Session not found");
    }
    if (existing.status === "Closed") {
      throw new HttpError(409, "Closed sessions cannot change visibility");
    }

    const updated = await this.repository.toggleSessionVisibility(sessionId);
    if (!updated) {
      throw new HttpError(404, "Session not found");
    }
    return updated;
  }

  async toggleStrictRoles(sessionId: string) {
    const existing = await this.repository.getSession(sessionId);
    if (!existing) {
      throw new HttpError(404, "Session not found");
    }
    if (existing.status === "Closed") {
      throw new HttpError(409, "Closed sessions cannot change strict role mode");
    }

    const updated = await this.repository.toggleStrictRoles(sessionId);
    if (!updated) {
      throw new HttpError(404, "Session not found");
    }
    return updated;
  }

  async deleteSession(sessionId: string, deletedBy: string) {
    const deleted = await this.repository.deleteSession(sessionId, deletedBy);
    if (!deleted) {
      throw new HttpError(404, "Session not found");
    }
    return { deleted: true };
  }

  async getSession(sessionId: string) {
    const session = await this.repository.getSession(sessionId);
    if (!session) {
      throw new HttpError(404, "Session not found");
    }
    return session;
  }

  listPairs(sessionId: string) {
    return this.repository.listPairs(sessionId);
  }

  createPair(sessionId: string, input: PairInput) {
    return this.repository.createPair(sessionId, input);
  }

  async updatePair(pairId: string, input: PairUpdateInput) {
    const row = await this.repository.updatePair(pairId, input);
    if (!row) {
      throw new HttpError(404, "Pair not found");
    }
    return row;
  }

  async deletePair(pairId: string) {
    const removed = await this.repository.deletePair(pairId);
    if (!removed) {
      throw new HttpError(404, "Pair not found");
    }
    return { deleted: true };
  }

  listAttendance(sessionId: string) {
    return this.repository.listAttendance(sessionId);
  }

  upsertAttendance(input: AttendanceUpsertInput) {
    return this.repository.upsertAttendance(input);
  }

  async scanAttendance(input: AttendanceScanInput): Promise<AttendanceScanResult> {
    const parsed = parseAttendanceToken(input.token);
    if (!parsed) {
      throw new HttpError(400, "Invalid attendance QR token");
    }

    const nowMinute = Math.floor(Date.now() / 60_000);
    if (Math.abs(nowMinute - parsed.minute) > 1) {
      throw new HttpError(409, "Attendance QR token has expired");
    }

    const scannedSession = await this.repository.getSession(parsed.sessionId);
    if (!scannedSession) {
      throw new HttpError(404, "Session not found for attendance token");
    }

    const users = await this.repository.listUsers();
    const scannedUser = users.find((row) => row.id === input.userId);
    const targetCountry = normalizeCountry(scannedUser?.country) ?? scannedSession.country;
    const allSessions = await this.repository.listSessions();
    const targetSessions = allSessions.filter(
      (session) =>
        session.startDate === scannedSession.startDate && session.country === targetCountry && session.status !== "Closed"
    );

    if (!targetSessions.some((row) => row.id === scannedSession.id)) {
      targetSessions.unshift(scannedSession);
    }

    const nowIso = new Date().toISOString();
    let primaryResult: { updated: Awaited<ReturnType<typeof this.repository.upsertAttendance>>; slot: AttendanceScanResult["slot"] } | null =
      null;
    const affectedSessionIds: string[] = [];

    for (const session of targetSessions) {
      const existing = (await this.repository.listAttendance(session.id)).find((row) => row.userId === input.userId);
      const nextAttendance: AttendanceUpsertInput = {
        sessionId: session.id,
        userId: input.userId,
        name: input.name,
        attended: true,
        checkIn: existing?.checkIn,
        lunchOut: existing?.lunchOut,
        lunchIn: existing?.lunchIn,
        checkOut: existing?.checkOut
      };

      let slot: AttendanceScanResult["slot"] = "check_in";
      if (!existing?.checkIn) {
        nextAttendance.checkIn = nowIso;
        slot = "check_in";
      } else if (!existing.lunchOut) {
        nextAttendance.lunchOut = nowIso;
        slot = "lunch_out";
      } else if (!existing.lunchIn) {
        nextAttendance.lunchIn = nowIso;
        slot = "lunch_in";
      } else {
        nextAttendance.checkOut = nowIso;
        slot = "check_out";
      }

      const updated = await this.repository.upsertAttendance(nextAttendance);
      affectedSessionIds.push(session.id);
      if (session.id === parsed.sessionId) {
        primaryResult = { updated, slot };
      }
    }

    if (!primaryResult) {
      throw new HttpError(500, "Unable to update attendance for scanned session");
    }

    const slotMessages: Record<NonNullable<AttendanceScanResult["slot"]>, string> = {
      check_in: "Check-in recorded!",
      lunch_out: "Lunch out recorded!",
      lunch_in: "Back from lunch recorded!",
      check_out: "End-of-day check out recorded!"
    };

    return {
      sessionId: parsed.sessionId,
      userId: input.userId,
      attended: true,
      checkIn: primaryResult.updated.checkIn ?? nowIso,
      lunchOut: primaryResult.updated.lunchOut,
      lunchIn: primaryResult.updated.lunchIn,
      checkOut: primaryResult.updated.checkOut,
      slot: primaryResult.slot,
      affectedSessionIds,
      message: slotMessages[primaryResult.slot]
    };
  }

  async toggleAttendance(sessionId: string, userId: string) {
    const row = await this.repository.toggleAttendance(sessionId, userId);
    if (!row) {
      throw new HttpError(404, "Attendee not found");
    }
    return row;
  }

  listItems(sessionId: string) {
    return this.repository.listItems(sessionId);
  }

  getItemById(itemId: string) {
    return this.repository.getItemById(itemId);
  }

  async updateItemCount(input: ItemCountUpdateInput) {
    const item = await this.repository.updateItemCount(input);
    if (!item) {
      throw new HttpError(404, "Item not found");
    }
    return item;
  }

  async updateItem(input: ItemUpdateInput) {
    const item = await this.repository.updateItem(input);
    if (!item) {
      throw new HttpError(404, "Item not found");
    }
    return item;
  }

  bulkAssignItems(input: BulkAssignInput) {
    return this.repository.bulkAssignItems(input);
  }

  getDashboard(sessionId: string) {
    return this.repository.getDashboard(sessionId);
  }

  getDashboardDetails(sessionId: string) {
    return this.repository.getDashboardDetails(sessionId);
  }

  listAudit(sessionId: string) {
    return this.repository.listAudit(sessionId);
  }

  createAuditEntry(input: AuditInsertInput) {
    return this.repository.insertAudit(input);
  }

  listNewItems(sessionId: string) {
    return this.repository.listNewItems(sessionId);
  }

  createNewItem(input: NewItemInput) {
    return this.repository.createNewItem(input);
  }

  async updateNewItemStatus(itemId: string, status: "Pending" | "Approved" | "Rejected") {
    const row = await this.repository.updateNewItemStatus(itemId, status);
    if (!row) {
      throw new HttpError(404, "New item not found");
    }
    return row;
  }

  listApprovals(sessionId: string) {
    return this.repository.listApprovals(sessionId);
  }

  createAdjustment(input: import("../domain/types").CreateAdjustmentInput) {
    return this.repository.createAdjustment(input);
  }

  listAdjustments(filters: { submittedBy?: string; sessionId?: string }) {
    return this.repository.listAdjustments(filters);
  }

  async reviewApproval(input: ApprovalActionInput) {
    const existing = (await this.repository.listApprovals(input.sessionId)).find((row) => row.id === input.approvalId);
    if (!existing) {
      throw new HttpError(404, "Approval record not found");
    }

    if (existing.status !== "Pending") {
      throw new HttpError(409, `Approval record has already been reviewed as ${existing.status}`);
    }

    const row = await this.repository.actOnApproval(input);
    if (!row) {
      const latest = (await this.repository.listApprovals(input.sessionId)).find((entry) => entry.id === input.approvalId);
      if (latest && latest.status !== "Pending") {
        throw new HttpError(409, `Approval record has already been reviewed as ${latest.status}`);
      }
      throw new HttpError(404, "Approval record not found");
    }
    return row;
  }

  listBins() {
    return this.repository.listBins();
  }

  listWhCodes(sessionId?: string) {
    return this.repository.listWhCodes(sessionId);
  }

  searchWarehouseItems(query: string, sessionId?: string) {
    return this.repository.searchWarehouseItems(query, sessionId);
  }

  listAssignedItems(input?: { assignee?: string; userName?: string }) {
    return this.repository.listAssignedItems(input);
  }

  async submitCount(input: CountSubmissionInput) {
    await this.repository.submitCount(input);
    return { submitted: true };
  }

  listCountHistory(filters?: { submittedBy?: string; sessionId?: string }) {
    return this.repository.listCountHistory(filters);
  }

  listUsers() {
    return this.repository.listUsers();
  }

  findUserByEmail(email: string) {
    return this.repository.findUserByEmail(email);
  }

  async updateUserRole(userId: string, role: "User" | "Admin" | "Super Admin") {
    const row = await this.repository.updateUserRole(userId, role);
    if (!row) {
      throw new HttpError(404, "User not found");
    }
    return row;
  }

  async resetSessionAssignments(sessionId: string) {
    const session = await this.repository.getSession(sessionId);
    if (!session) {
      throw new HttpError(404, "Session not found");
    }
    return this.repository.resetSessionAssignments(sessionId);
  }

  importWebhookPayload(payload: WebhookImportPayload) {
    return this.repository.importWebhookPayload(payload);
  }
}
