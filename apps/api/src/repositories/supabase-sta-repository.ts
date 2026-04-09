import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ApprovalActionInput,
  ApprovalRecord,
  BulkAssignInput,
  CountHistoryEntry,
  CreateAdjustmentInput,
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
import type { StaRepository } from "./sta-repository";

const SESSION_SELECT =
  "id,name,type,country,entity,start_date,end_date,status,progress,is_recount,parent_id,user_visible,strict_roles";
const ITEM_SELECT =
  "id,session_id,code,name,group,batch,uom,packaging_size,expiry_date,category,bin_location,wh_code,sap_qty,count_qty,staged_count_qty,damaged_qty,expired_qty,dropped,item_status,new_item,src,pair_id,assigned_to,submitted_by,remark,admin_remark,photos,checker_status";

function parseNumber(value: unknown, fallback: number | null = null): number | null {
  if (value === null || value === undefined) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function firstNonEmptyString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text.length > 0) {
      return text;
    }
  }
  return null;
}

function resolveItemStatus(sapQty: number, countQty: number | null): ItemMasterItem["status"] {
  if (countQty === null) return "Pending";
  return sapQty === countQty ? "Matched" : "Variance";
}

function toSession(row: Record<string, unknown>): Session {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    type: (row.type === "Cycle Count" ? "Cycle Count" : "Year End") as Session["type"],
    country: (row.country === "Singapore" ? "Singapore" : "Malaysia") as Session["country"],
    entity: (row.entity === "BMSD" || row.entity === "BMSG" ? row.entity : "BMS") as Session["entity"],
    startDate: String(row.start_date ?? ""),
    endDate: String(row.end_date ?? ""),
    status: (row.status === "Draft" || row.status === "Closed" ? row.status : "Active") as Session["status"],
    progress: parseNumber(row.progress, 0) ?? 0,
    isRecount: Boolean(row.is_recount),
    parentId: row.parent_id ? String(row.parent_id) : null,
    userVisible: typeof row.user_visible === "boolean" ? row.user_visible : true,
    strictRoles: Boolean(row.strict_roles)
  };
}

function toPair(row: Record<string, unknown>): PairAssignment {
  return {
    id: String(row.id),
    counter: String(row.counter_name ?? ""),
    checker: String(row.checker_name ?? ""),
    counter2: row.counter2_name ? String(row.counter2_name) : undefined,
    warehouse: String(row.warehouse_id ?? ""),
    role: (row.role === "Admin" ? "Admin" : "User") as PairAssignment["role"]
  };
}

function toAttendance(row: Record<string, unknown>): AttendanceRecord {
  return {
    userId: String(row.user_id),
    name: String(row.user_name ?? ""),
    attended: Boolean(row.attended),
    checkIn: row.check_in ? String(row.check_in) : undefined,
    lunchOut: row.lunch_out ? String(row.lunch_out) : undefined,
    lunchIn: row.lunch_in ? String(row.lunch_in) : undefined,
    checkOut: row.check_out ? String(row.check_out) : undefined
  };
}

function toItem(row: Record<string, unknown>): ItemMasterItem {
  const sapQty = parseNumber(row.sap_qty, 0) ?? 0;
  const countQty = parseNumber(row.count_qty, null);
  const rawStatus = row.item_status;
  const rawStatusText = typeof rawStatus === "string" ? rawStatus.trim() : "";
  const status =
    rawStatus === "Matched" || rawStatus === "Variance" || rawStatus === "Pending" || rawStatus === "Not Found"
      ? rawStatus
      : resolveItemStatus(sapQty, countQty);

  return {
    id: String(row.id),
    sessionId: row.session_id ? String(row.session_id) : undefined,
    code: String(row.code ?? ""),
    name: String(row.name ?? ""),
    group: row.group ? String(row.group) : undefined,
    batch: row.batch ? String(row.batch) : null,
    uom: row.uom ? String(row.uom) : undefined,
    packagingSize: row.packaging_size ? String(row.packaging_size) : null,
    expiryDate: row.expiry_date ? String(row.expiry_date).slice(0, 10) : null,
    category: row.category ? String(row.category) : null,
    warehouse: String(row.bin_location ?? ""),
    whCode: row.wh_code ? String(row.wh_code) : null,
    sapQty,
    countQty,
    stagedCountQty: parseNumber(row.staged_count_qty, null),
    damagedQty: parseNumber(row.damaged_qty, null),
    expiredQty: parseNumber(row.expired_qty, null),
    dropped: Boolean(row.dropped),
    status,
    countStatus: rawStatusText || null,
    newItem: row.new_item === "Yes" ? "Yes" : row.new_item === "No" ? "No" : null,
    source: row.src ? String(row.src) : null,
    assignedPair: String(row.pair_id ?? ""),
    assignedTo: row.assigned_to ? String(row.assigned_to) : null,
    submittedBy: row.submitted_by ? String(row.submitted_by) : null,
    remark: row.remark ? String(row.remark) : null,
    adminRemark: row.admin_remark ? String(row.admin_remark) : "",
    photos: Array.isArray(row.photos)
      ? (row.photos as unknown[]).map((value) => String(value))
      : typeof row.photos === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(row.photos) as unknown;
            if (Array.isArray(parsed)) return parsed.map((value) => String(value));
          } catch {
            return [];
          }
          return [];
        })()
      : [],
    checkerStatus:
      row.checker_status === "Pending" || row.checker_status === "Approved" || row.checker_status === "Rejected"
        ? row.checker_status
        : null
  };
}

function toAudit(row: Record<string, unknown>): AuditEntry {
  return {
    id: String(row.id),
    itemCode: String(row.item_code ?? ""),
    itemName: String(row.item_name ?? ""),
    submittedBy: String(row.submitted_by ?? ""),
    qty: parseNumber(row.count_qty, 0) ?? 0,
    countedAt: String(row.counted_at ?? new Date().toISOString()),
    damagedQty: parseNumber(row.damaged_qty, null),
    expiredQty: parseNumber(row.expired_qty, null),
    warehouse: row.warehouse ? String(row.warehouse) : undefined,
    remark: row.remark ? String(row.remark) : undefined
  };
}

function toNewItem(row: Record<string, unknown>): NewItemRecord {
  let status: NewItemRecord["status"] = "Pending";
  if (row.item_status === "Approved") status = "Approved";
  if (row.item_status === "Rejected") status = "Rejected";

  return {
    id: String(row.id),
    sessionId: row.session_id ? String(row.session_id) : undefined,
    code: String(row.code ?? ""),
    name: String(row.name ?? ""),
    uom: row.uom ? String(row.uom) : null,
    batch: row.batch ? String(row.batch) : null,
    status,
    submittedBy: String(row.submitted_by ?? ""),
    warehouse: row.bin_location ? String(row.bin_location) : null,
    qty: parseNumber(row.count_qty, null),
    damagedQty: parseNumber(row.damaged_qty, null),
    expiredQty: parseNumber(row.expired_qty, null),
    remark: row.remark ? String(row.remark) : null,
    photos: Array.isArray(row.photos)
      ? (row.photos as unknown[]).map((value) => String(value))
      : typeof row.photos === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(row.photos) as unknown;
            if (Array.isArray(parsed)) return parsed.map((value) => String(value));
          } catch {
            return [];
          }
          return [];
        })()
      : [],
    createdAt: row.created_at ? String(row.created_at) : undefined,
    checkerStatus:
      row.checker_status === "Pending" || row.checker_status === "Approved" || row.checker_status === "Rejected"
        ? row.checker_status
        : null
  };
}

function toApproval(row: Record<string, unknown>): ApprovalRecord {
  const normalizedStatus: ApprovalRecord["status"] =
    row.status === "Approved" || row.status === "Rejected" ? row.status : "Pending";

  return {
    id: String(row.id),
    itemId: row.item_id ? String(row.item_id) : undefined,
    itemCode: String(row.item_code ?? ""),
    itemName: String(row.item_name ?? ""),
    oldQty: parseNumber(row.old_qty, 0) ?? 0,
    newQty: parseNumber(row.new_qty, 0) ?? 0,
    status: normalizedStatus,
    submittedBy: String(row.submitted_by ?? ""),
    oldBin: null,
    newBin: null,
    createdAt: row.created_at ? String(row.created_at) : undefined,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null
  };
}

function toWarehouseItem(row: Record<string, unknown>): WarehouseItem {
  return {
    id: String(row.id),
    sessionId: row.session_id ? String(row.session_id) : undefined,
    code: String(row.code ?? ""),
    name: String(row.name ?? ""),
    warehouse: String(row.bin_location ?? ""),
    whCode: row.wh_code ? String(row.wh_code) : null,
    assignedTo: String(row.assigned_to ?? row.pair_id ?? ""),
    sapQty: parseNumber(row.sap_qty, 0) ?? 0,
    countQty: parseNumber(row.count_qty, null),
    photos: Array.isArray(row.photos) ? (row.photos as unknown[]).map((value) => String(value)) : [],
    uom: row.uom ? String(row.uom) : undefined,
    packagingSize: row.packaging_size ? String(row.packaging_size) : undefined,
    batch: row.batch ? String(row.batch) : null
  };
}

function createCodedError(message: string, code: string, details?: unknown): Error & { code: string; details?: unknown } {
  const error = new Error(message) as Error & { code: string; details?: unknown };
  error.code = code;
  error.details = details;
  return error;
}

function mergeBinLocations(existing: string | null, incoming: string | null): string | null {
  const existingParts = existing ? existing.split(";").map(s => s.trim()).filter(Boolean) : [];
  const incomingParts = incoming ? incoming.split(";").map(s => s.trim()).filter(Boolean) : [];
  const merged = [...new Set([...existingParts, ...incomingParts])];
  return merged.length > 0 ? merged.join(";") : null;
}

function updateBinLocation(current: string | null, oldBin: string | null, newBin: string | null): string | null {
  const currentParts = current ? current.split(";").map(s => s.trim()).filter(Boolean) : [];
  const oldParts = oldBin ? oldBin.split(";").map(s => s.trim()).filter(Boolean) : [];
  const newParts = newBin ? newBin.split(";").map(s => s.trim()).filter(Boolean) : [];
  const withoutOld = currentParts.filter(p => !oldParts.includes(p));
  const merged = [...new Set([...withoutOld, ...newParts])];
  return merged.length > 0 ? merged.join(";") : null;
}

function isMissingApprovalRpc(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown };
  // 42702 = ambiguous column reference (RPC has SQL bug), fall back to JS implementation
  return record.code === "PGRST202" || record.code === "42883" || record.code === "42702";
}

function extractApprovalRpcRow(value: unknown): Record<string, unknown> | null {
  if (!value) return null;

  if (Array.isArray(value)) {
    return extractApprovalRpcRow(value[0] ?? null);
  }

  if (typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const nested = record.sta_act_on_approval;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }

  return record;
}

export class SupabaseStaRepository implements StaRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listSessions(): Promise<Session[]> {
    const { data, error } = await this.client
      .from("sessions")
      .select(SESSION_SELECT)
      .or("is_deleted.eq.false,is_deleted.is.null")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row) => toSession(row as Record<string, unknown>));
  }

  async createSession(input: NewSessionInput): Promise<Session> {
    const year = input.startDate.slice(0, 4);
    const typeCode = input.isRecount ? "RC" : input.type === "Year End" ? "YE" : "CC";
    const countryCode = input.country === "Malaysia" ? "MY" : "SG";
    const prefix = `${typeCode}${year}-${countryCode}-`;

    const { data: existing, error: existingError } = await this.client
      .from("sessions")
      .select("id")
      .like("id", `${prefix}%`);

    if (existingError) throw existingError;

    let maxSeq = 0;
    for (const row of existing ?? []) {
      const id = String((row as Record<string, unknown>).id ?? "");
      const parsed = Number(id.slice(prefix.length));
      if (Number.isFinite(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }

    const id = `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;

    const insertRow = {
      id,
      name: input.name,
      type: input.type,
      country: input.country,
      entity: input.entity,
      start_date: input.startDate,
      end_date: input.endDate,
      status: "Draft",
      progress: 0,
      is_recount: Boolean(input.isRecount),
      parent_id: input.isRecount ? input.parentId ?? null : null,
      user_visible: input.userVisible ?? false,
      is_deleted: false
    };

    const { data, error } = await this.client
      .from("sessions")
      .insert(insertRow)
      .select(SESSION_SELECT)
      .single();

    if (error) throw error;
    return toSession(data as Record<string, unknown>);
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const { data, error } = await this.client
      .from("sessions")
      .select(SESSION_SELECT)
      .eq("id", sessionId)
      .or("is_deleted.eq.false,is_deleted.is.null")
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return toSession(data as Record<string, unknown>);
  }

  async updateSession(sessionId: string, input: NewSessionInput): Promise<Session | null> {
    const { data, error } = await this.client
      .from("sessions")
      .update({
        name: input.name,
        type: input.type,
        country: input.country,
        entity: input.entity,
        start_date: input.startDate,
        end_date: input.endDate,
        is_recount: Boolean(input.isRecount),
        parent_id: input.isRecount ? input.parentId ?? null : null
      })
      .eq("id", sessionId)
      .or("is_deleted.eq.false,is_deleted.is.null")
      .select(SESSION_SELECT)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return toSession(data as Record<string, unknown>);
  }

  async reopenSession(sessionId: string): Promise<Session | null> {
    const { data, error } = await this.client
      .from("sessions")
      .update({
        status: "Active"
      })
      .eq("id", sessionId)
      .or("is_deleted.eq.false,is_deleted.is.null")
      .select(SESSION_SELECT)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return toSession(data as Record<string, unknown>);
  }

  async endSession(sessionId: string): Promise<Session | null> {
    const { data, error } = await this.client
      .from("sessions")
      .update({
        status: "Closed",
        progress: 100
      })
      .eq("id", sessionId)
      .or("is_deleted.eq.false,is_deleted.is.null")
      .select(SESSION_SELECT)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return toSession(data as Record<string, unknown>);
  }

  async toggleSessionVisibility(sessionId: string): Promise<Session | null> {
    const { data: existing, error: existingError } = await this.client
      .from("sessions")
      .select("id,user_visible,status")
      .eq("id", sessionId)
      .or("is_deleted.eq.false,is_deleted.is.null")
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) return null;

    const row = existing as Record<string, unknown>;
    const nextVisible = row.user_visible !== true;
    const nextStatus: Session["status"] = nextVisible ? "Active" : "Draft";

    const { data, error } = await this.client
      .from("sessions")
      .update({
        user_visible: nextVisible,
        status: nextStatus
      })
      .eq("id", sessionId)
      .or("is_deleted.eq.false,is_deleted.is.null")
      .select(SESSION_SELECT)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return toSession(data as Record<string, unknown>);
  }

  async toggleStrictRoles(sessionId: string): Promise<Session | null> {
    const { data: existing, error: existingError } = await this.client
      .from("sessions")
      .select("id,strict_roles")
      .eq("id", sessionId)
      .or("is_deleted.eq.false,is_deleted.is.null")
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) return null;
    const row = existing as Record<string, unknown>;
    const nextValue = row.strict_roles !== true;

    const { data, error } = await this.client
      .from("sessions")
      .update({ strict_roles: nextValue })
      .eq("id", sessionId)
      .or("is_deleted.eq.false,is_deleted.is.null")
      .select(SESSION_SELECT)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return toSession(data as Record<string, unknown>);
  }

  async deleteSession(sessionId: string, deletedBy: string): Promise<boolean> {
    const { data: session, error: sessionError } = await this.client
      .from("sessions")
      .select("id,name")
      .eq("id", sessionId)
      .or("is_deleted.eq.false,is_deleted.is.null")
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) return false;

    const deletionRecord = {
      id: `DEL-${Date.now().toString(36).toUpperCase()}`,
      session_id: sessionId,
      session_name: String((session as Record<string, unknown>).name ?? sessionId),
      deleted_by: deletedBy
    };

    const { error: auditError } = await this.client.from("session_deletions").insert(deletionRecord);
    if (auditError && auditError.code !== "42P01") {
      throw auditError;
    }

    const { error, count } = await this.client
      .from("sessions")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString()
      }, { count: "exact" })
      .eq("id", sessionId)
      .or("is_deleted.eq.false,is_deleted.is.null");

    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async listPairs(sessionId: string): Promise<PairAssignment[]> {
    const { data, error } = await this.client
      .from("pairs")
      .select("id,counter_name,checker_name,counter2_name,warehouse_id,role")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data ?? []).map((row) => toPair(row as Record<string, unknown>));
  }

  async createPair(sessionId: string, input: PairInput): Promise<PairAssignment> {
    const row = {
      id: `P-${Date.now().toString(36).toUpperCase()}`,
      session_id: sessionId,
      counter_name: input.counter,
      checker_name: input.checker,
      counter2_name: input.counter2 ?? null,
      warehouse_id: input.warehouse,
      role: input.role,
      counter_absent: false,
      checker_absent: false,
      counter2_absent: false,
      progress: 0
    };

    const { data, error } = await this.client
      .from("pairs")
      .insert(row)
      .select("id,counter_name,checker_name,counter2_name,warehouse_id,role")
      .single();

    if (error) throw error;
    return toPair(data as Record<string, unknown>);
  }

  async updatePair(pairId: string, input: PairUpdateInput): Promise<PairAssignment | null> {
    const { data, error } = await this.client
      .from("pairs")
      .update({
        session_id: input.sessionId,
        counter_name: input.counter,
        checker_name: input.checker,
        counter2_name: input.counter2 ?? null,
        warehouse_id: input.warehouse,
        role: input.role
      })
      .eq("id", pairId)
      .select("id,counter_name,checker_name,counter2_name,warehouse_id,role")
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return toPair(data as Record<string, unknown>);
  }

  async deletePair(pairId: string): Promise<boolean> {
    const { error, count } = await this.client.from("pairs").delete({ count: "exact" }).eq("id", pairId);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async listAttendance(sessionId: string): Promise<AttendanceRecord[]> {
    const { data, error } = await this.client
      .from("session_attendees")
      .select("user_id,user_name,attended,check_in,lunch_out,lunch_in,check_out")
      .eq("session_id", sessionId)
      .order("user_name", { ascending: true });

    if (error) throw error;
    return (data ?? []).map((row) => toAttendance(row as Record<string, unknown>));
  }

  async upsertAttendance(input: AttendanceUpsertInput): Promise<AttendanceRecord> {
    const payload = {
      session_id: input.sessionId,
      user_id: input.userId,
      user_name: input.name,
      attended: input.attended,
      check_in: input.checkIn ?? null,
      lunch_out: input.lunchOut ?? null,
      lunch_in: input.lunchIn ?? null,
      check_out: input.checkOut ?? null
    };

    const { data, error } = await this.client
      .from("session_attendees")
      .upsert(payload, { onConflict: "session_id,user_id" })
      .select("user_id,user_name,attended,check_in,lunch_out,lunch_in,check_out")
      .single();

    if (error) throw error;
    return toAttendance(data as Record<string, unknown>);
  }

  async toggleAttendance(sessionId: string, userId: string): Promise<AttendanceRecord | null> {
    const { data: existing, error: existingError } = await this.client
      .from("session_attendees")
      .select("user_id,user_name,attended,check_in,lunch_out,lunch_in,check_out")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) return null;

    const nextAttended = !(existing as Record<string, unknown>).attended;
    const { data, error } = await this.client
      .from("session_attendees")
      .update({
        attended: nextAttended,
        check_in: nextAttended ? new Date().toISOString() : null
      })
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .select("user_id,user_name,attended,check_in,lunch_out,lunch_in,check_out")
      .single();

    if (error) throw error;
    return toAttendance(data as Record<string, unknown>);
  }

  async listItems(sessionId: string): Promise<ItemMasterItem[]> {
    const PAGE_SIZE = 1000;
    const all: Record<string, unknown>[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await this.client
        .from("items")
        .select(ITEM_SELECT)
        .eq("session_id", sessionId)
        .order("code", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;
      all.push(...(data as Record<string, unknown>[]));
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    return all.map((row) => toItem(row));
  }

  async getItemById(itemId: string): Promise<ItemMasterItem | null> {
    const { data, error } = await this.client.from("items").select(ITEM_SELECT).eq("id", itemId).limit(1).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toItem(data as Record<string, unknown>);
  }

  async updateItemCount(input: ItemCountUpdateInput): Promise<ItemMasterItem | null> {
    const { data: existing, error: existingError } = await this.client
      .from("items")
      .select("sap_qty")
      .eq("id", input.itemId)
      .eq("session_id", input.sessionId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) return null;

    const sapQty = parseNumber((existing as Record<string, unknown>).sap_qty, 0) ?? 0;
    const status = resolveItemStatus(sapQty, input.countQty);

    const { data, error } = await this.client
      .from("items")
      .update({
        count_qty: input.countQty,
        item_status: status
      })
      .eq("id", input.itemId)
      .eq("session_id", input.sessionId)
      .select(ITEM_SELECT)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return toItem(data as Record<string, unknown>);
  }

  async updateItem(input: ItemUpdateInput): Promise<ItemMasterItem | null> {
    const patch: Record<string, unknown> = {};
    let shouldRecomputeStatus = false;

    if (input.countQty !== undefined) {
      patch.count_qty = input.countQty;
      shouldRecomputeStatus = true;
    }
    if (input.damagedQty !== undefined) patch.damaged_qty = input.damagedQty;
    if (input.expiredQty !== undefined) patch.expired_qty = input.expiredQty;
    if (input.dropped !== undefined) patch.dropped = input.dropped;
    if (input.assignedPair !== undefined) patch.pair_id = input.assignedPair;
    if (input.assignedTo !== undefined) patch.assigned_to = input.assignedTo;
    if (input.adminRemark !== undefined) patch.admin_remark = input.adminRemark;

    if (shouldRecomputeStatus) {
      const { data: existing, error: existingError } = await this.client
        .from("items")
        .select("sap_qty")
        .eq("id", input.itemId)
        .eq("session_id", input.sessionId)
        .maybeSingle();

      if (existingError) throw existingError;
      if (!existing) return null;
      const sapQty = parseNumber((existing as Record<string, unknown>).sap_qty, 0) ?? 0;
      patch.item_status = resolveItemStatus(sapQty, input.countQty ?? null);
    }

    const { data, error } = await this.client
      .from("items")
      .update(patch)
      .eq("id", input.itemId)
      .eq("session_id", input.sessionId)
      .select(ITEM_SELECT)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return toItem(data as Record<string, unknown>);
  }

  async bulkAssignItems(input: BulkAssignInput): Promise<{ updated: number }> {
    if (input.itemIds.length === 0) {
      return { updated: 0 };
    }

    const { data, error } = await this.client
      .from("items")
      .update({
        pair_id: input.pairId,
        assigned_to: input.assignedTo ?? input.pairId
      })
      .eq("session_id", input.sessionId)
      .in("id", input.itemIds)
      .select("id");

    if (error) throw error;
    return { updated: data?.length ?? 0 };
  }

  async getDashboard(sessionId: string): Promise<DashboardSummary> {
    const PAGE_SIZE = 1000;
    const all: Record<string, unknown>[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await this.client
        .from("items")
        .select("count_qty,new_item")
        .eq("session_id", sessionId)
        .eq("dropped", false)
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;
      all.push(...(data as Record<string, unknown>[]));
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const totalItems = all.length;
    const countedItems = all.filter((row) => row.count_qty !== null && row.count_qty !== undefined).length;
    const pendingItems = totalItems - countedItems;
    const newItems = all.filter((row) => row.new_item === "Yes").length;

    return {
      totalItems,
      countedItems,
      pendingItems,
      newItems
    };
  }

  async getDashboardDetails(sessionId: string): Promise<DashboardDetails> {
    const PAGE_SIZE = 1000;
    const all: Record<string, unknown>[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await this.client
        .from("items")
        .select("group,wh_code,bin_location,count_qty,sap_qty,item_status,new_item,dropped")
        .eq("session_id", sessionId)
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;
      all.push(...(data as Record<string, unknown>[]));
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const rows = all.filter((row) => row.dropped !== true);
    const summarize = (grouped: Record<string, unknown>[]) => {
      const total = grouped.length;
      const counted = grouped.filter((row) => row.count_qty !== null && row.count_qty !== undefined).length;
      const pending = grouped.filter((row) => row.count_qty === null || row.count_qty === undefined).length;
      const matched = grouped.filter((row) => row.item_status === "Matched").length;
      const variance = grouped.filter((row) => row.item_status === "Variance").length;
      const notFound = grouped.filter((row) => row.count_qty === null || row.count_qty === undefined).length;
      const newItems = grouped.filter((row) => row.new_item === "Yes").length;
      return { total, counted, pending, matched, variance, notFound, newItems };
    };

    const byGroupMap = new Map<string, Record<string, unknown>[]>();
    const byWarehouseMap = new Map<string, Record<string, unknown>[]>();
    rows.forEach((row) => {
      const groupKey = String(row.group ?? "Ungrouped");
      const warehouseCode = String(row.wh_code ?? "").trim();
      const warehouseKey = warehouseCode || String(row.bin_location ?? "-");
      byGroupMap.set(groupKey, [...(byGroupMap.get(groupKey) ?? []), row]);
      byWarehouseMap.set(warehouseKey, [...(byWarehouseMap.get(warehouseKey) ?? []), row]);
    });

    const byGroup = Array.from(byGroupMap.entries())
      .map(([key, grouped]) => ({ key, ...summarize(grouped) }))
      .sort((a, b) => a.key.localeCompare(b.key));
    const byWarehouse = Array.from(byWarehouseMap.entries())
      .map(([key, grouped]) => ({ key, ...summarize(grouped) }))
      .sort((a, b) => a.key.localeCompare(b.key));

    return { byGroup, byWarehouse };
  }

  async listAudit(sessionId: string): Promise<AuditEntry[]> {
    const { data, error } = await this.client
      .from("item_audit")
      .select("id,item_code,item_name,submitted_by,count_qty,damaged_qty,expired_qty,warehouse,counted_at,remark")
      .eq("session_id", sessionId)
      .order("counted_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row) => toAudit(row as Record<string, unknown>));
  }

  async insertAudit(input: AuditInsertInput): Promise<AuditEntry> {
    const row = {
      id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      session_id: input.sessionId,
      item_id: input.itemId,
      item_code: input.itemCode,
      item_name: input.itemName,
      submitted_by: input.submittedBy,
      pair_id: input.pairId ?? null,
      count_qty: input.qty,
      warehouse: input.warehouse ?? null,
      remark: input.remark ?? null
    };

    const { data, error } = await this.client
      .from("item_audit")
      .insert(row)
      .select("id,item_code,item_name,submitted_by,count_qty,damaged_qty,expired_qty,warehouse,counted_at,remark")
      .single();

    if (error) throw error;
    return toAudit(data as Record<string, unknown>);
  }

  async listNewItems(sessionId: string): Promise<NewItemRecord[]> {
    const { data, error } = await this.client
      .from("items")
      .select(
        "id,session_id,code,name,batch,uom,item_status,submitted_by,bin_location,count_qty,damaged_qty,expired_qty,remark,photos,created_at,checker_status"
      )
      .eq("session_id", sessionId)
      .eq("new_item", "Yes")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row) => toNewItem(row as Record<string, unknown>));
  }

  async createNewItem(input: NewItemInput): Promise<NewItemRecord> {
    const photos = input.photos?.filter((photo) => photo.trim().length > 0) ?? [];
    const row = {
      id: `NEW-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      session_id: input.sessionId,
      code: input.code,
      name: input.name,
      batch: input.batch?.trim() || null,
      uom: input.uom?.trim() || null,
      bin_location: input.warehouse ?? null,
      wh_code: "New Item",
      new_item: "Yes",
      item_status: "Pending",
      submitted_by: input.submittedBy,
      dropped: false,
      sap_qty: 0,
      count_qty: input.qty ?? null,
      damaged_qty: input.damagedQty ?? null,
      expired_qty: input.expiredQty ?? null,
      remark: input.remark?.trim() || null,
      photos
    };

    const { data, error } = await this.client
      .from("items")
      .insert(row)
      .select(
        "id,session_id,code,name,batch,uom,item_status,submitted_by,bin_location,count_qty,damaged_qty,expired_qty,remark,photos,created_at,checker_status"
      )
      .single();

    if (error) throw error;

    const created = data as Record<string, unknown>;
    await this.client.from("item_audit").insert({
      id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      session_id: input.sessionId,
      item_id: created.id,
      item_code: input.code,
      item_name: input.name,
      submitted_by: input.submittedBy,
      count_qty: input.qty ?? null,
      warehouse: input.warehouse ?? null,
      remark: input.remark ?? null
    });

    return toNewItem(created);
  }

  async updateNewItemStatus(itemId: string, status: NewItemRecord["status"]): Promise<NewItemRecord | null> {
    const { data, error } = await this.client
      .from("items")
      .update({ item_status: status })
      .eq("id", itemId)
      .eq("new_item", "Yes")
      .select(
        "id,session_id,code,name,batch,uom,item_status,submitted_by,bin_location,count_qty,damaged_qty,expired_qty,remark,photos,created_at,checker_status"
      )
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return toNewItem(data as Record<string, unknown>);
  }

  async createAdjustment(input: CreateAdjustmentInput): Promise<ApprovalRecord> {
    const { data: itemRow, error: itemError } = await this.client
      .from("items")
      .select("id,session_id,code,name,count_qty,bin_location")
      .eq("id", input.itemId)
      .maybeSingle();

    if (itemError || !itemRow) {
      throw itemError ?? new Error("Item not found");
    }

    const item = itemRow as Record<string, unknown>;
    const oldQty = parseNumber(item.count_qty, 0) ?? 0;

    const row = {
      id: `ADJ-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      session_id: input.sessionId,
      item_id: input.itemId,
      item_code: String(item.code ?? ""),
      item_name: String(item.name ?? ""),
      old_qty: oldQty,
      new_qty: input.newQty,
      status: "Pending",
      submitted_by: input.submittedBy
    };

    const { data, error } = await this.client
      .from("count_adjustments")
      .insert(row)
      .select("id,item_id,item_code,item_name,old_qty,new_qty,status,submitted_by,created_at,reviewed_by,reviewed_at")
      .single();

    if (error) throw error;
    return toApproval(data as Record<string, unknown>);
  }

  async listAdjustments(filters: { submittedBy?: string; sessionId?: string }): Promise<ApprovalRecord[]> {
    let query = this.client
      .from("count_adjustments")
      .select("id,item_id,item_code,item_name,old_qty,new_qty,status,submitted_by,created_at,reviewed_by,reviewed_at")
      .order("created_at", { ascending: false });

    if (filters.sessionId) {
      query = query.eq("session_id", filters.sessionId);
    }
    if (filters.submittedBy) {
      query = query.ilike("submitted_by", `%${filters.submittedBy.trim()}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => toApproval(row as Record<string, unknown>));
  }

  async listApprovals(sessionId: string): Promise<ApprovalRecord[]> {
    const { data, error } = await this.client
      .from("count_adjustments")
      .select("id,item_id,item_code,item_name,old_qty,new_qty,status,submitted_by,created_at,reviewed_by,reviewed_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row) => toApproval(row as Record<string, unknown>));
  }

  async actOnApproval(input: ApprovalActionInput): Promise<ApprovalRecord | null> {
    const { data, error } = await this.client.rpc("sta_act_on_approval", {
      p_session_id: input.sessionId,
      p_approval_id: input.approvalId,
      p_action: input.action,
      p_reviewed_by: input.reviewedBy
    });

    if (error) {
      if (isMissingApprovalRpc(error)) {
        return this.actOnApprovalFallback(input);
      }
      throw error;
    }

    const rpcRow = extractApprovalRpcRow(data);
    if (!rpcRow) {
      return null;
    }

    return toApproval(rpcRow);
  }

  private async actOnApprovalFallback(input: ApprovalActionInput): Promise<ApprovalRecord | null> {
    const { data: adjustment, error: adjustmentError } = await this.client
      .from("count_adjustments")
      .select("*")
      .eq("id", input.approvalId)
      .eq("session_id", input.sessionId)
      .maybeSingle();

    if (adjustmentError) throw adjustmentError;
    if (!adjustment) return null;

    const adj = adjustment as Record<string, unknown>;
    const currentStatus = String(adj.status ?? "Pending");
    if (currentStatus !== "Pending") {
      throw createCodedError(`Approval record has already been reviewed as ${currentStatus}`, "P0001");
    }

    const nextStatus = input.action;

    const { data: updatedAdjustment, error: updateAdjustmentError } = await this.client
      .from("count_adjustments")
      .update({
        status: nextStatus,
        reviewed_by: input.reviewedBy,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", input.approvalId)
      .eq("session_id", input.sessionId)
      .eq("status", "Pending")
      .select("id,item_code,item_name,old_qty,new_qty,status,submitted_by,created_at,reviewed_by,reviewed_at")
      .maybeSingle();

    if (updateAdjustmentError) throw updateAdjustmentError;
    if (!updatedAdjustment) {
      throw createCodedError("Approval record has already been reviewed", "P0001");
    }

    if (nextStatus === "Rejected") {
      return toApproval(updatedAdjustment as Record<string, unknown>);
    }

    const itemId = String(adj.item_id ?? "");
    if (!itemId) {
      return toApproval(updatedAdjustment as Record<string, unknown>);
    }

    const { data: itemRow, error: itemError } = await this.client
      .from("items")
      .select("count_qty,sap_qty,bin_location")
      .eq("id", itemId)
      .maybeSingle();

    if (itemError || !itemRow) {
      throw itemError ?? new Error("Item not found");
    }

    const currentQty = parseNumber((itemRow as Record<string, unknown>).count_qty, 0) ?? 0;
    const oldQty = parseNumber(adj.old_qty, 0) ?? 0;
    const newQty = parseNumber(adj.new_qty, 0) ?? 0;
    const adjustedQty = currentQty - oldQty + newQty;

    const sapQty = parseNumber((itemRow as Record<string, unknown>).sap_qty, 0) ?? 0;
    const currentBin = (itemRow as Record<string, unknown>).bin_location
      ? String((itemRow as Record<string, unknown>).bin_location)
      : null;
    const approvedBin = updateBinLocation(
      currentBin,
      adj.old_bin_location ? String(adj.old_bin_location) : null,
      adj.new_bin_location ? String(adj.new_bin_location) : null
    ) ?? "";
    const status = resolveItemStatus(sapQty, adjustedQty);

    const { error: itemUpdateError } = await this.client
      .from("items")
      .update({
        count_qty: adjustedQty,
        item_status: status,
        bin_location: approvedBin || null
      })
      .eq("id", itemId);

    if (itemUpdateError) {
      throw itemUpdateError;
    }

    const baseRemark = `Approved by ${input.reviewedBy}: ${oldQty} -> ${newQty} (adjusted: ${adjustedQty})`;
    const oldBin = String(adj.old_bin_location ?? "").trim();
    const normalizedApprovedBin = (approvedBin || "").trim();
    const remark =
      oldBin && normalizedApprovedBin && oldBin !== normalizedApprovedBin
        ? `${baseRemark}; bin ${oldBin} -> ${normalizedApprovedBin}`
        : baseRemark;

    const { error: auditError } = await this.client.from("item_audit").insert({
      id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      session_id: input.sessionId,
      item_id: itemId,
      item_code: adj.item_code,
      item_name: adj.item_name,
      submitted_by: adj.submitted_by,
      count_qty: adjustedQty,
      warehouse: approvedBin || null,
      remark
    });

    if (auditError) {
      throw auditError;
    }

    return toApproval(updatedAdjustment as Record<string, unknown>);
  }

  async listBins(): Promise<string[]> {
    const { data, error } = await this.client
      .from("warehouses")
      .select("id")
      .order("id", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map((row) => String(row.id)).filter(Boolean);
  }

  async listWhCodes(sessionId?: string): Promise<string[]> {
    let query = this.client
      .from("items")
      .select("wh_code")
      .not("wh_code", "is", null)
      .neq("wh_code", "");
    if (sessionId) {
      query = query.eq("session_id", sessionId);
    }
    const { data, error } = await query;
    if (error) throw error;
    const codes = Array.from(
      new Set(((data ?? []) as Record<string, unknown>[]).map((row) => String(row.wh_code)).filter(Boolean))
    ).sort();
    return codes;
  }

  async searchWarehouseItems(query: string, sessionId?: string): Promise<WarehouseItem[]> {
    const normalized = query.trim();
    const PAGE_SIZE = 1000;
    const allRows: Record<string, unknown>[] = [];
    let from = 0;

    while (true) {
      let base = this.client
        .from("items")
        .select("id,session_id,code,name,batch,bin_location,wh_code,assigned_to,pair_id,sap_qty,count_qty,photos,uom,packaging_size")
        .eq("dropped", false)
        .order("code", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (sessionId) {
        base = base.eq("session_id", sessionId);
      }

      if (normalized) {
        base = base.or(`code.ilike.%${normalized}%,name.ilike.%${normalized}%,batch.ilike.%${normalized}%,bin_location.ilike.%${normalized}%`);
      }

      const { data, error } = await base;
      if (error) throw error;

      const rows = (data ?? []) as Record<string, unknown>[];
      allRows.push(...rows);

      if (rows.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    return allRows.map((row) => toWarehouseItem(row));
  }

  async listAssignedItems(input?: { assignee?: string; userName?: string }): Promise<WarehouseItem[]> {
    const assignee = input?.assignee?.trim() ?? "";
    const userName = input?.userName?.trim() ?? "";
    let query = this.client
      .from("items")
      .select("id,session_id,code,name,bin_location,wh_code,assigned_to,pair_id,sap_qty,count_qty,photos,uom,packaging_size")
      .eq("dropped", false)
      .order("code", { ascending: true });

    if (assignee) {
      query = query.or(`pair_id.eq.${assignee},assigned_to.eq.${assignee}`);
    } else if (userName) {
      const { data: pairRows, error: pairError } = await this.client
        .from("pairs")
        .select("id")
        .or(`counter_name.eq.${userName},checker_name.eq.${userName},counter2_name.eq.${userName}`);
      if (pairError) throw pairError;

      const pairIds = Array.from(
        new Set(((pairRows ?? []) as Record<string, unknown>[]).map((row) => String(row.id ?? "")).filter(Boolean))
      );

      if (pairIds.length > 0) {
        query = query.or(`assigned_to.ilike.%${userName}%,pair_id.in.(${pairIds.join(",")})`);
      } else {
        query = query.ilike("assigned_to", `%${userName}%`);
      }
    } else {
      query = query.or("pair_id.not.is.null,assigned_to.not.is.null");
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => toWarehouseItem(row as Record<string, unknown>));
  }

  async submitCount(input: CountSubmissionInput): Promise<void> {
    const { data: currentItem, error: itemError } = await this.client
      .from("items")
      .select("id,session_id,code,name,sap_qty,count_qty,bin_location,pair_id,photos")
      .eq("id", input.itemId)
      .maybeSingle();

    if (itemError || !currentItem) {
      throw itemError ?? new Error("Item not found");
    }

    const row = currentItem as Record<string, unknown>;
    const sapQty = parseNumber(row.sap_qty, 0) ?? 0;

    // Sum count qty when the same item is counted by multiple counters
    const existingCountQty = parseNumber(row.count_qty, 0) ?? 0;
    const newCountQty = existingCountQty + input.qty;

    const status = resolveItemStatus(sapQty, newCountQty);

    const existingPhotos: string[] = Array.isArray(row.photos) ? (row.photos as unknown[]).map(String) : [];
    const mergedPhotos = input.photos && input.photos.length > 0 ? [...existingPhotos, ...input.photos] : existingPhotos;

    // Merge bin locations: combine existing bins with newly submitted bins (deduplicated)
    const resolvedBin = mergeBinLocations(
      row.bin_location ? String(row.bin_location) : null,
      input.binLocation ?? null
    );

    const updatePayload: Record<string, unknown> = {
      count_qty: newCountQty,
      damaged_qty: input.damagedQty ?? null,
      expired_qty: input.expiredQty ?? null,
      item_status: status,
      submitted_by: input.submittedBy,
      remark: input.remark ?? null,
      photos: mergedPhotos
    };
    if (resolvedBin) {
      updatePayload.bin_location = resolvedBin;
    }

    const { error: updateError } = await this.client
      .from("items")
      .update(updatePayload)
      .eq("id", input.itemId);

    if (updateError) throw updateError;

    const { error: auditError } = await this.client.from("item_audit").insert({
      id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      session_id: row.session_id,
      item_id: row.id,
      item_code: row.code,
      item_name: row.name,
      submitted_by: input.submittedBy,
      pair_id: row.pair_id,
      count_qty: input.qty,
      damaged_qty: input.damagedQty ?? null,
      expired_qty: input.expiredQty ?? null,
      warehouse: resolvedBin,
      remark: input.remark ?? null
    });

    if (auditError) throw auditError;
  }

  async listCountHistory(filters?: { submittedBy?: string; sessionId?: string }): Promise<CountHistoryEntry[]> {
    const submittedBy = filters?.submittedBy;
    const sessionId = filters?.sessionId;
    let query = this.client
      .from("item_audit")
      .select("id,item_id,session_id,item_code,item_name,count_qty,counted_at,submitted_by,warehouse,remark")
      .order("counted_at", { ascending: false });

    if (sessionId && sessionId.trim()) {
      query = query.eq("session_id", sessionId.trim());
    }

    if (submittedBy && submittedBy.trim()) {
      query = query.ilike("submitted_by", `%${submittedBy.trim()}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as Record<string, unknown>[];
    const sessionIds = Array.from(new Set(rows.map((row) => String(row.session_id ?? "")).filter(Boolean)));
    const sessionNameMap = new Map<string, string>();
    if (sessionIds.length > 0) {
      const { data: sessions, error: sessionError } = await this.client.from("sessions").select("id,name").in("id", sessionIds);
      if (sessionError) throw sessionError;
      ((sessions ?? []) as Record<string, unknown>[]).forEach((sessionRow) => {
        sessionNameMap.set(String(sessionRow.id), String(sessionRow.name ?? sessionRow.id));
      });
    }

    return rows.map((row) => ({
      id: String(row.id),
      itemId: row.item_id ? String(row.item_id) : undefined,
      sessionId: String(row.session_id ?? ""),
      sessionName: sessionNameMap.get(String(row.session_id ?? "")) ?? String(row.session_id ?? ""),
      itemCode: String(row.item_code ?? ""),
      itemName: String(row.item_name ?? ""),
      qty: parseNumber(row.count_qty, 0) ?? 0,
      countedAt: String(row.counted_at ?? new Date().toISOString()),
      submittedBy: String(row.submitted_by ?? ""),
      binLocation: row.warehouse ? String(row.warehouse) : undefined,
      remark: row.remark ? String(row.remark) : undefined
    }));
  }

  async listUsers(): Promise<UserRoleRecord[]> {
    const { data, error } = await this.client
      .from("users")
      .select("id,name,display_name,email,role,country,account_enabled")
      .order("name", { ascending: true });

    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      name: String(row.display_name ?? row.name ?? ""),
      email: row.email ? String(row.email) : null,
      role: (row.role === "Admin" || row.role === "Super Admin" ? row.role : "User") as UserRoleRecord["role"],
      country: row.country === "Singapore" ? "Singapore" : row.country === "Malaysia" ? "Malaysia" : null,
      accountEnabled: row.account_enabled === undefined ? true : Boolean(row.account_enabled)
    }));
  }

  async findUserByEmail(email: string): Promise<UserRoleRecord | null> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return null;

    const { data, error } = await this.client
      .from("users")
      .select("id,name,display_name,email,role,country,account_enabled")
      .ilike("email", normalized)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const row = data as Record<string, unknown>;
    return {
      id: String(row.id),
      name: String(row.display_name ?? row.name ?? ""),
      email: row.email ? String(row.email) : null,
      role: (row.role === "Admin" || row.role === "Super Admin" ? row.role : "User") as UserRoleRecord["role"],
      country: row.country === "Singapore" ? "Singapore" : row.country === "Malaysia" ? "Malaysia" : null,
      accountEnabled: row.account_enabled === undefined ? true : Boolean(row.account_enabled)
    };
  }

  async updateUserRole(userId: string, role: UserRoleRecord["role"]): Promise<UserRoleRecord | null> {
    const { data, error } = await this.client
      .from("users")
      .update({ role })
      .eq("id", userId)
      .select("id,name,display_name,email,role,country,account_enabled")
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const row = data as Record<string, unknown>;
    return {
      id: String(row.id),
      name: String(row.display_name ?? row.name ?? ""),
      email: row.email ? String(row.email) : null,
      role: (row.role === "Admin" || row.role === "Super Admin" ? row.role : "User") as UserRoleRecord["role"],
      country: row.country === "Singapore" ? "Singapore" : row.country === "Malaysia" ? "Malaysia" : null,
      accountEnabled: row.account_enabled === undefined ? true : Boolean(row.account_enabled)
    };
  }

  async resetSessionAssignments(sessionId: string): Promise<SessionAssignmentResetResult> {
    const [pairsCountResult, attendanceCountResult, itemsCountResult] = await Promise.all([
      this.client.from("pairs").select("id", { count: "exact", head: true }).eq("session_id", sessionId),
      this.client.from("session_attendees").select("user_id", { count: "exact", head: true }).eq("session_id", sessionId),
      this.client
        .from("items")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .or("pair_id.not.is.null,assigned_to.not.is.null")
    ]);

    if (pairsCountResult.error) throw pairsCountResult.error;
    if (attendanceCountResult.error) throw attendanceCountResult.error;
    if (itemsCountResult.error) throw itemsCountResult.error;

    const [itemsUpdateResult, pairsDeleteResult, attendanceDeleteResult] = await Promise.all([
      this.client.from("items").update({ pair_id: null, assigned_to: null }).eq("session_id", sessionId),
      this.client.from("pairs").delete().eq("session_id", sessionId),
      this.client.from("session_attendees").delete().eq("session_id", sessionId)
    ]);

    if (itemsUpdateResult.error) throw itemsUpdateResult.error;
    if (pairsDeleteResult.error) throw pairsDeleteResult.error;
    if (attendanceDeleteResult.error) throw attendanceDeleteResult.error;

    return {
      pairsDeleted: pairsCountResult.count ?? 0,
      attendanceDeleted: attendanceCountResult.count ?? 0,
      itemsUnassigned: itemsCountResult.count ?? 0
    };
  }

  async importWebhookPayload(payload: WebhookImportPayload): Promise<{ imported: number }> {
    if (payload.source === "bins") {
      const incomingBins = new Map<string, { id: string; name: string }>();
      for (const row of payload.data) {
        const record = row as Record<string, unknown>;
        const id = String(record.bin_location ?? record.id ?? "").trim();
        if (!id) continue;
        incomingBins.set(id, { id, name: String(record.location_assigned ?? record.name ?? id) });
      }
      if (incomingBins.size === 0) return { imported: 0 };

      const { data: existingBins, error: fetchErr } = await this.client.from("warehouses").select("id");
      if (fetchErr) throw fetchErr;
      const existingIds = new Set((existingBins ?? []).map((r: Record<string, unknown>) => String(r.id)));

      const toInsert = Array.from(incomingBins.values()).filter((b) => !existingIds.has(b.id));
      const toDelete = Array.from(existingIds).filter((id) => !incomingBins.has(id));

      const chunkSize = 500;
      if (toInsert.length > 0) {
        for (let i = 0; i < toInsert.length; i += chunkSize) {
          const { error } = await this.client.from("warehouses").upsert(toInsert.slice(i, i + chunkSize), { onConflict: "id", ignoreDuplicates: true });
          if (error) throw error;
        }
      }
      if (toDelete.length > 0) {
        for (let i = 0; i < toDelete.length; i += chunkSize) {
          const { error } = await this.client.from("warehouses").delete().in("id", toDelete.slice(i, i + chunkSize));
          if (error) throw error;
        }
      }
      return { imported: toInsert.length };
    }

    if (payload.source === "users") {
      // Fetch all existing users
      const { data: existingRows, error: fetchError } = await this.client
        .from("users")
        .select("id,email,role,name,display_name,department,company_name,job_title,country,account_enabled,initials");
      if (fetchError) throw fetchError;

      const existing = (existingRows ?? []) as Record<string, unknown>[];
      const existingByEmail = new Map<string, Record<string, unknown>>();
      const existingById = new Map<string, Record<string, unknown>>();
      for (const row of existing) {
        existingById.set(String(row.id), row);
        const email = row.email ? String(row.email).trim().toLowerCase() : "";
        if (email) existingByEmail.set(email, row);
      }

      // Parse and deduplicate incoming users
      const incomingUsers: Record<string, unknown>[] = [];
      const seenEmails = new Set<string>();
      const seenIds = new Set<string>();

      for (const entry of payload.data) {
        const row = entry as Record<string, unknown>;
        const id = String(row.id ?? randomUUID());
        const displayName = String(row.display_name ?? row.full_name ?? "").trim();
        const givenName = String(row.given_name ?? "").trim();
        const surname = String(row.surname ?? "").trim();
        const fallbackName = `${givenName} ${surname}`.trim();
        const initials = `${givenName.slice(0, 1)}${surname.slice(0, 1)}`.toUpperCase() || null;
        const rawEmail = row.email_address ? String(row.email_address) : row.email ? String(row.email) : "";
        const normalizedEmail = rawEmail.trim().toLowerCase();

        if (seenIds.has(id)) continue;
        if (normalizedEmail && seenEmails.has(normalizedEmail)) continue;

        incomingUsers.push({
          id,
          name: displayName || fallbackName || String(row.name ?? ""),
          display_name: displayName || null,
          email: normalizedEmail || null,
          department: row.department ? String(row.department) : null,
          company_name: row.company_name ? String(row.company_name) : null,
          job_title: row.job_title ? String(row.job_title) : null,
          country: row.country ? String(row.country) : null,
          account_enabled: typeof row.account_enabled === "boolean" ? row.account_enabled : true,
          initials,
          role: "User"
        });

        seenIds.add(id);
        if (normalizedEmail) seenEmails.add(normalizedEmail);
      }

      // Add users that don't exist yet
      const toInsert = incomingUsers.filter((user) => {
        const email = user.email ? String(user.email) : "";
        return !existingById.has(String(user.id)) && !(email && existingByEmail.has(email));
      });

      // Remove existing users not present in the import
      const incomingIds = new Set(incomingUsers.map((u) => String(u.id)));
      const incomingEmails = new Set(incomingUsers.map((u) => (u.email ? String(u.email) : "")).filter(Boolean));
      const toDeleteIds = existing
        .filter((row) => {
          const email = row.email ? String(row.email).trim().toLowerCase() : "";
          return !incomingIds.has(String(row.id)) && !(email && incomingEmails.has(email));
        })
        .map((row) => String(row.id));

      const chunkSize = 500;

      if (toInsert.length > 0) {
        for (let index = 0; index < toInsert.length; index += chunkSize) {
          const chunk = toInsert.slice(index, index + chunkSize);
          const { error } = await this.client.from("users").insert(chunk);
          if (error) throw error;
        }
      }

      if (toDeleteIds.length > 0) {
        for (let index = 0; index < toDeleteIds.length; index += chunkSize) {
          const chunk = toDeleteIds.slice(index, index + chunkSize);
          const { error } = await this.client.from("users").delete().in("id", chunk);
          if (error) throw error;
        }
      }

      return { imported: toInsert.length };
    }

    if (payload.source === "items") {
      if (!payload.sessionId) {
        return { imported: 0 };
      }

      const mappedItemsById = new Map<string, Record<string, unknown>>();
      payload.data.forEach((entry) => {
        const row = entry as Record<string, unknown>;
        const id = String(row.ItemInternalId ?? row.id ?? randomUUID());
        const code = String(row.item_code ?? row.code ?? "");
        const name = String(row.item_name ?? row.name ?? "");
        const sapQty = parseNumber(row.sap_qty ?? row.sapQty ?? row.sap ?? 0, 0) ?? 0;
        const binLocation =
          firstNonEmptyString(row, ["item_location", "itemLocation", "bin_location", "binLocation", "warehouse", "location"]) ?? null;
        const whCode =
          firstNonEmptyString(row, ["wh_code", "whCode", "warehouse_code", "warehouseCode", "wh", "warehouse_id"]) ?? null;

        mappedItemsById.set(id, {
          id,
          session_id: payload.sessionId,
          code,
          name,
          group: String(row.item_group ?? row.group ?? row.grp ?? ""),
          batch: row.batch_serial_num ? String(row.batch_serial_num) : row.batch ? String(row.batch) : null,
          uom: row.uom ? String(row.uom) : "PCS",
          packaging_size: row.packaging_size ? String(row.packaging_size) : row.pkg ? String(row.pkg) : null,
          bin_location: binLocation,
          sap_qty: sapQty,
          count_qty: null,
          staged_count_qty: null,
          pair_id: null,
          assigned_to: null,
          dropped: false,
          entity: row.entity ? String(row.entity) : payload.entity ?? null,
          wh_code: whCode,
          expiry_date: row.expiry_date ? String(row.expiry_date).split("T")[0] : null,
          category: row.category ? String(row.category) : null,
          remark: row.remark ? String(row.remark) : null,
          new_item: row.new_item ? String(row.new_item) : "No",
          variance: parseNumber(row.variance_d2, 0) ?? 0,
          cost: parseNumber(row.cost, 0) ?? 0,
          is_delete: Boolean(row.is_delete)
        });
      });
      const mappedItems = Array.from(mappedItemsById.values());

      // Delete all existing items for the session, then insert fresh
      const { error: deleteError } = await this.client
        .from("items")
        .delete()
        .eq("session_id", payload.sessionId);
      if (deleteError) throw deleteError;

      const chunkSize = 500;
      for (let index = 0; index < mappedItems.length; index += chunkSize) {
        const chunk = mappedItems.slice(index, index + chunkSize);
        const { error } = await this.client.from("items").insert(chunk);
        if (error) throw error;
      }

      return { imported: mappedItems.length };
    }

    return { imported: 0 };
  }

  async findLinkedRecountSessions(parentSessionId: string): Promise<Session[]> {
    const { data, error } = await this.client
      .from("sessions")
      .select(SESSION_SELECT)
      .eq("parent_id", parentSessionId)
      .eq("is_recount", true)
      .or("is_deleted.eq.false,is_deleted.is.null");

    if (error) throw error;
    return (data ?? []).map((row) => toSession(row as Record<string, unknown>));
  }

  async autoAssignNewItemsToAdminPairs(parentSessionId: string, recountSessionId: string): Promise<number> {
    return this.autoLoadItemsToRecountSession(parentSessionId, recountSessionId);
  }

  async autoLoadItemsToRecountSession(parentSessionId: string, recountSessionId: string): Promise<number> {
    // --- Step 1: Get existing items in recount session to avoid duplicates (match by code+batch) ---
    const { data: existingData, error: existingError } = await this.client
      .from("items")
      .select("code,batch")
      .eq("session_id", recountSessionId);

    if (existingError) throw existingError;
    const existingKeys = new Set(
      ((existingData ?? []) as Record<string, unknown>[]).map(
        (row) => `${String(row.code ?? "").toLowerCase()}::${String(row.batch ?? "").toLowerCase()}`
      )
    );

    // --- Step 2: Get qualifying items from parent session (paginated to bypass 1000-row limit) ---
    const PAGE_SIZE = 1000;
    const parentItems: Record<string, unknown>[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await this.client
        .from("items")
        .select("code,name,batch,uom,packaging_size,bin_location,wh_code,sap_qty,count_qty,new_item,submitted_by,remark,photos,group,category,expiry_date")
        .eq("session_id", parentSessionId)
        .eq("dropped", false)
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;
      parentItems.push(...(data as Record<string, unknown>[]));
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    // --- Step 3: Build rows — no assignment yet; store parent bin_location for later assignment step ---
    const rows: Record<string, unknown>[] = [];
    const ts = Date.now();

    for (let i = 0; i < parentItems.length; i++) {
      const item = parentItems[i];
      const isNewItem = item.new_item === "Yes";
      const countQty = parseNumber(item.count_qty, null);
      const sapQty = parseNumber(item.sap_qty, 0) ?? 0;
      const isVariance = !isNewItem && countQty !== null && countQty !== sapQty;
      const isNotFound = !isNewItem && countQty === null;

      if (!isNewItem && !isVariance && !isNotFound) continue;

      const dedupeKey = `${String(item.code ?? "").toLowerCase()}::${String(item.batch ?? "").toLowerCase()}`;
      if (existingKeys.has(dedupeKey)) continue;
      existingKeys.add(dedupeKey);

      rows.push({
        id: `RC-${ts}-${Math.random().toString(36).slice(2, 7)}-${i}`,
        session_id: recountSessionId,
        code: String(item.code ?? ""),
        name: String(item.name ?? ""),
        group: item.group ? String(item.group) : null,
        batch: item.batch ? String(item.batch) : null,
        uom: item.uom ? String(item.uom) : null,
        packaging_size: item.packaging_size ? String(item.packaging_size) : null,
        expiry_date: item.expiry_date ? String(item.expiry_date) : null,
        category: item.category ? String(item.category) : null,
        // Store parent bin so autoAssignRecountItems can match pairs by bin
        bin_location: item.bin_location ? String(item.bin_location) : null,
        wh_code: item.wh_code ? String(item.wh_code) : isNewItem ? "New Item" : null,
        new_item: isNewItem ? "Yes" : "No",
        item_status: isVariance ? "Variance" : isNotFound ? "Not Found" : "Pending",
        sap_qty: sapQty,
        count_qty: null,
        damaged_qty: null,
        expired_qty: null,
        dropped: false,
        submitted_by: item.submitted_by ? String(item.submitted_by) : null,
        remark: item.remark ? String(item.remark) : null,
        photos: Array.isArray(item.photos) ? item.photos : [],
        pair_id: null,
        assigned_to: null
      });
    }

    if (rows.length === 0) return 0;

    // --- Step 4: Insert in chunks (no assignment — autoAssignRecountItems runs after) ---
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error: insertError } = await this.client.from("items").insert(rows.slice(i, i + CHUNK));
      if (insertError) throw insertError;
    }

    return rows.length;
  }

  async autoAssignRecountItems(recountSessionId: string): Promise<void> {
    // Load pairs for this recount session
    const { data: pairsData, error: pairsError } = await this.client
      .from("pairs")
      .select("id,warehouse_id,role")
      .eq("session_id", recountSessionId);

    if (pairsError) throw pairsError;
    const pairs = (pairsData ?? []) as Array<{ id: string; warehouse_id: string; role: string }>;
    if (pairs.length === 0) return;

    // Load unassigned items in recount session
    // item_status="Variance" = variance from parent; new_item="Yes" = new item; else = not found
    const { data: itemsData, error: itemsError } = await this.client
      .from("items")
      .select("id,bin_location,new_item,item_status")
      .eq("session_id", recountSessionId)
      .is("pair_id", null);

    if (itemsError) throw itemsError;
    const items = (itemsData ?? []) as Record<string, unknown>[];
    if (items.length === 0) return;

    // Helper: find a pair matching a bin location (item bin_location may be semicolon-separated)
    // roleFilter: "Admin" = admin pairs only, "User" = non-admin pairs only, null = any pair
    const findPairByBin = (binLocation: string | null, roleFilter: "Admin" | "User" | null): { id: string } | null => {
      if (!binLocation) return null;
      const itemBins = binLocation.split(";").map((b) => b.trim().toLowerCase()).filter(Boolean);
      for (const pair of pairs) {
        if (roleFilter === "Admin" && pair.role !== "Admin") continue;
        if (roleFilter === "User" && pair.role === "Admin") continue;
        const pairBins = String(pair.warehouse_id ?? "")
          .split(",")
          .map((b) => b.trim().toLowerCase())
          .filter(Boolean);
        if (itemBins.some((b) => pairBins.includes(b))) return pair;
      }
      return null;
    };

    // Build a map: pairId → item ids to assign
    const assignments = new Map<string, string[]>();

    for (const item of items) {
      const isNewItem = item.new_item === "Yes";
      const isVariance = item.item_status === "Variance";
      const binLocation = item.bin_location ? String(item.bin_location) : null;

      let pairId: string | null = null;
      if (isNewItem) {
        // New item → first Admin pair (no bin matching required)
        pairId = pairs.find((p) => p.role === "Admin")?.id ?? null;
      } else if (isVariance) {
        // Variance → user (non-admin) pair matching bin
        pairId = findPairByBin(binLocation, "User")?.id ?? null;
      }
      // Not found → no assignment

      if (pairId !== null) {
        const list = assignments.get(pairId) ?? [];
        list.push(String(item.id));
        assignments.set(pairId, list);
      }
    }

    // Batch update per pair
    for (const [pairId, itemIds] of assignments) {
      const { error } = await this.client
        .from("items")
        .update({ pair_id: pairId, assigned_to: pairId })
        .in("id", itemIds);
      if (error) throw error;
    }
  }
}

export function createSupabaseStaRepository(client: SupabaseClient): SupabaseStaRepository {
  return new SupabaseStaRepository(client);
}
