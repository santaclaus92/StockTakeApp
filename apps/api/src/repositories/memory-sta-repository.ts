import { randomUUID } from "node:crypto";
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
  ItemCountUpdateInput,
  ItemMasterItem,
  ItemUpdateInput,
  NewItemInput,
  NewItemRecord,
  NewSessionInput,
  PairAssignment,
  PairInput,
  PairUpdateInput,
  Session,
  UserRoleRecord,
  WarehouseItem,
  WebhookImportPayload
} from "../domain/types";
import type { StaRepository } from "./sta-repository";

const now = new Date().toISOString();

function clone<T>(value: T): T {
  return structuredClone(value);
}

function resolveStatus(sapQty: number, countQty: number | null): ItemMasterItem["status"] {
  if (countQty === null) {
    return "Pending";
  }
  return sapQty === countQty ? "Matched" : "Variance";
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
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

const sessionsSeed: Session[] = [
  {
    id: "YE2026-MY-001",
    name: "Year End 2026 Malaysia",
    type: "Year End",
    country: "Malaysia",
    entity: "BMS",
    startDate: "2026-12-20",
    endDate: "2026-12-31",
    status: "Active",
    progress: 46,
    isRecount: false,
    parentId: null,
    userVisible: true,
    strictRoles: false
  },
  {
    id: "CC2026-SG-001",
    name: "Cycle Count Q2 Singapore",
    type: "Cycle Count",
    country: "Singapore",
    entity: "BMSG",
    startDate: "2026-04-01",
    endDate: "2026-04-30",
    status: "Draft",
    progress: 12,
    isRecount: false,
    parentId: null,
    userVisible: false,
    strictRoles: false
  }
];

const pairsSeed: Record<string, PairAssignment[]> = {
  "YE2026-MY-001": [
    { id: "P-01", counter: "Ahmad Hassan", checker: "Siti Che", warehouse: "A-01", role: "User" },
    { id: "P-02", counter: "Jarvis Ng", checker: "Lim Eng", counter2: "Nur Ain", warehouse: "B-02", role: "Admin" }
  ],
  "CC2026-SG-001": [{ id: "P-11", counter: "Ryan Tan", checker: "Jia Wei", warehouse: "S-01", role: "User" }]
};

const attendanceSeed: Record<string, AttendanceRecord[]> = {
  "YE2026-MY-001": [
    { userId: "U-001", name: "Ahmad Hassan", attended: true, checkIn: now },
    { userId: "U-002", name: "Siti Che", attended: true, checkIn: now },
    { userId: "U-003", name: "Jarvis Ng", attended: false }
  ],
  "CC2026-SG-001": [{ userId: "U-101", name: "Ryan Tan", attended: true, checkIn: now }]
};

const itemsSeed: Record<string, ItemMasterItem[]> = {
  "YE2026-MY-001": [
    {
      id: "I-1001",
      code: "ITM-1001",
      name: "Hydraulic Pump A200",
      group: "Pump",
      batch: "BT-2026-A200",
      uom: "PCS",
      packagingSize: "Box of 5",
      expiryDate: null,
      category: "Mechanical",
      warehouse: "A-01",
      whCode: "WH-A",
      sapQty: 50,
      countQty: 49,
      stagedCountQty: null,
      dropped: false,
      status: "Variance",
      countStatus: "Variance",
      newItem: "No",
      source: "SAP",
      assignedPair: "P-01",
      submittedBy: "Ahmad Hassan",
      remark: "Manual recount due to shelf mismatch",
      adminRemark: ""
    },
    {
      id: "I-1002",
      code: "ITM-1002",
      name: "Conveyor Belt 5m",
      group: "Belt",
      batch: "BT-2026-B500",
      uom: "PCS",
      packagingSize: "Each",
      expiryDate: null,
      category: "Mechanical",
      warehouse: "B-02",
      whCode: "WH-B",
      sapQty: 12,
      countQty: 12,
      stagedCountQty: null,
      dropped: false,
      status: "Matched",
      countStatus: "Matched",
      newItem: "No",
      source: "SAP",
      assignedPair: "P-02",
      submittedBy: "Siti Che",
      remark: "",
      adminRemark: ""
    },
    {
      id: "I-1003",
      code: "ITM-1003",
      name: "Cable Tie Pack",
      group: "Consumable",
      batch: "BT-2026-CB1",
      uom: "PKT",
      packagingSize: "Pack of 100",
      expiryDate: null,
      category: "Consumable",
      warehouse: "A-01",
      whCode: "WH-A",
      sapQty: 300,
      countQty: null,
      stagedCountQty: null,
      dropped: false,
      status: "Pending",
      countStatus: "Not found",
      newItem: "No",
      source: "SAP",
      assignedPair: "P-01",
      submittedBy: null,
      remark: "Pending first count",
      adminRemark: ""
    }
  ],
  "CC2026-SG-001": [
    {
      id: "I-2001",
      code: "ITM-2001",
      name: "Pressure Valve",
      group: "Valve",
      batch: "BT-2026-PV1",
      uom: "PCS",
      packagingSize: "Each",
      expiryDate: null,
      category: "Mechanical",
      warehouse: "S-01",
      whCode: "WH-SG",
      sapQty: 17,
      countQty: null,
      stagedCountQty: null,
      dropped: false,
      status: "Pending",
      countStatus: "Not found",
      newItem: "No",
      source: "SAP",
      assignedPair: "P-11",
      submittedBy: null,
      remark: "",
      adminRemark: ""
    }
  ]
};

const auditSeed: Record<string, AuditEntry[]> = {
  "YE2026-MY-001": [
    {
      id: "AUD-01",
      itemCode: "ITM-1002",
      itemName: "Conveyor Belt 5m",
      submittedBy: "Siti Che",
      qty: 12,
      countedAt: now,
      damagedQty: 0,
      expiredQty: 0,
      warehouse: "B-02",
      remark: "Initial count"
    }
  ],
  "CC2026-SG-001": []
};

const newItemsSeed: Record<string, NewItemRecord[]> = {
  "YE2026-MY-001": [
    {
      id: "NEW-01",
      sessionId: "YE2026-MY-001",
      code: "N-001",
      name: "Unknown Adapter",
      uom: "PCS",
      batch: "BT-2026-001",
      status: "Pending",
      submittedBy: "Ahmad Hassan",
      warehouse: "A-01",
      qty: 1,
      damagedQty: 0,
      expiredQty: 0,
      remark: "Submitted from warehouse",
      photos: [],
      createdAt: now,
      checkerStatus: "Pending"
    }
  ],
  "CC2026-SG-001": []
};

const approvalsSeed: Record<string, ApprovalRecord[]> = {
  "YE2026-MY-001": [
    {
      id: "APP-01",
      itemCode: "ITM-1001",
      itemName: "Hydraulic Pump A200",
      oldQty: 50,
      newQty: 49,
      status: "Pending",
      submittedBy: "Ahmad Hassan",
      oldBin: "A-01",
      newBin: "A-02",
      createdAt: now,
      reviewedBy: null,
      reviewedAt: null
    }
  ],
  "CC2026-SG-001": []
};

const usersSeed: UserRoleRecord[] = [
  {
    id: "U-ADMIN-1",
    name: "Admin User",
    email: "admin@example.com",
    role: "Admin",
    country: "Malaysia",
    accountEnabled: true
  },
  {
    id: "U-CNT-1",
    name: "Counter User",
    email: "counter@example.com",
    role: "User",
    country: "Malaysia",
    accountEnabled: true
  },
  {
    id: "U-SP-1",
    name: "Super Admin",
    email: "superadmin@example.com",
    role: "Super Admin",
    country: "Malaysia",
    accountEnabled: true
  }
];

export class InMemoryStaRepository implements StaRepository {
  private sessions = clone(sessionsSeed);
  private pairsBySession = clone(pairsSeed);
  private attendanceBySession = clone(attendanceSeed);
  private itemsBySession = clone(itemsSeed);
  private auditBySession = clone(auditSeed);
  private newItemsBySession = clone(newItemsSeed);
  private approvalsBySession = clone(approvalsSeed);
  private users = clone(usersSeed);

  private ensureSessionCollections(sessionId: string): void {
    if (!this.pairsBySession[sessionId]) this.pairsBySession[sessionId] = [];
    if (!this.attendanceBySession[sessionId]) this.attendanceBySession[sessionId] = [];
    if (!this.itemsBySession[sessionId]) this.itemsBySession[sessionId] = [];
    if (!this.auditBySession[sessionId]) this.auditBySession[sessionId] = [];
    if (!this.newItemsBySession[sessionId]) this.newItemsBySession[sessionId] = [];
    if (!this.approvalsBySession[sessionId]) this.approvalsBySession[sessionId] = [];
  }

  private nextSessionId(country: Session["country"], type: Session["type"], isRecount: boolean): string {
    const yy = new Date().getFullYear();
    const typeCode = isRecount ? "RC" : type === "Year End" ? "YE" : "CC";
    const countryCode = country === "Malaysia" ? "MY" : "SG";
    const prefix = `${typeCode}${yy}-${countryCode}-`;
    const sequence = this.sessions.filter((session) => session.id.startsWith(prefix)).length + 1;
    return `${prefix}${String(sequence).padStart(3, "0")}`;
  }

  async listSessions(): Promise<Session[]> {
    return clone(this.sessions);
  }

  async createSession(input: NewSessionInput): Promise<Session> {
    const isRecount = Boolean(input.isRecount);
    const created: Session = {
      id: this.nextSessionId(input.country, input.type, isRecount),
      ...input,
      status: "Draft",
      progress: 0,
      isRecount,
      parentId: isRecount ? input.parentId ?? null : null,
      userVisible: input.userVisible ?? false,
      strictRoles: false
    };
    this.sessions.unshift(created);
    this.ensureSessionCollections(created.id);
    return clone(created);
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const found = this.sessions.find((session) => session.id === sessionId) ?? null;
    return clone(found);
  }

  async updateSession(sessionId: string, input: NewSessionInput): Promise<Session | null> {
    const session = this.sessions.find((row) => row.id === sessionId);
    if (!session) return null;

    session.name = input.name;
    session.type = input.type;
    session.country = input.country;
    session.entity = input.entity;
    session.startDate = input.startDate;
    session.endDate = input.endDate;
    session.isRecount = Boolean(input.isRecount);
    session.parentId = session.isRecount ? input.parentId ?? null : null;
    return clone(session);
  }

  async reopenSession(sessionId: string): Promise<Session | null> {
    const session = this.sessions.find((row) => row.id === sessionId);
    if (!session) return null;
    session.status = "Active";
    return clone(session);
  }

  async endSession(sessionId: string): Promise<Session | null> {
    const session = this.sessions.find((row) => row.id === sessionId);
    if (!session) return null;
    session.status = "Closed";
    session.progress = 100;
    return clone(session);
  }

  async toggleSessionVisibility(sessionId: string): Promise<Session | null> {
    const session = this.sessions.find((row) => row.id === sessionId);
    if (!session) return null;
    session.userVisible = !session.userVisible;
    session.status = session.userVisible ? "Active" : "Draft";
    return clone(session);
  }

  async toggleStrictRoles(sessionId: string): Promise<Session | null> {
    const session = this.sessions.find((row) => row.id === sessionId);
    if (!session) return null;
    session.strictRoles = !session.strictRoles;
    return clone(session);
  }

  async deleteSession(sessionId: string, deletedBy: string): Promise<boolean> {
    void deletedBy;
    const before = this.sessions.length;
    this.sessions = this.sessions.filter((session) => session.id !== sessionId);
    return this.sessions.length !== before;
  }

  async listPairs(sessionId: string): Promise<PairAssignment[]> {
    this.ensureSessionCollections(sessionId);
    return clone(this.pairsBySession[sessionId]);
  }

  async createPair(sessionId: string, input: PairInput): Promise<PairAssignment> {
    this.ensureSessionCollections(sessionId);
    const created: PairAssignment = {
      id: `P-${Date.now()}`,
      ...input
    };
    this.pairsBySession[sessionId].push(created);
    return clone(created);
  }

  async updatePair(pairId: string, input: PairUpdateInput): Promise<PairAssignment | null> {
    this.ensureSessionCollections(input.sessionId);
    const row = this.pairsBySession[input.sessionId].find((pair) => pair.id === pairId);
    if (!row) return null;
    row.counter = input.counter;
    row.checker = input.checker;
    row.counter2 = input.counter2;
    row.warehouse = input.warehouse;
    row.role = input.role;
    return clone(row);
  }

  async deletePair(pairId: string): Promise<boolean> {
    for (const [sessionId, rows] of Object.entries(this.pairsBySession)) {
      const before = rows.length;
      this.pairsBySession[sessionId] = rows.filter((row) => row.id !== pairId);
      if (this.pairsBySession[sessionId].length !== before) {
        return true;
      }
    }
    return false;
  }

  async listAttendance(sessionId: string): Promise<AttendanceRecord[]> {
    this.ensureSessionCollections(sessionId);
    return clone(this.attendanceBySession[sessionId]);
  }

  async upsertAttendance(input: AttendanceUpsertInput): Promise<AttendanceRecord> {
    this.ensureSessionCollections(input.sessionId);
    const existing = this.attendanceBySession[input.sessionId].find((row) => row.userId === input.userId);
    if (existing) {
      existing.name = input.name;
      existing.attended = input.attended;
      existing.checkIn = input.checkIn;
      existing.lunchOut = input.lunchOut;
      existing.lunchIn = input.lunchIn;
      existing.checkOut = input.checkOut;
      return clone(existing);
    }

    const created: AttendanceRecord = {
      userId: input.userId,
      name: input.name,
      attended: input.attended,
      checkIn: input.checkIn,
      lunchOut: input.lunchOut,
      lunchIn: input.lunchIn,
      checkOut: input.checkOut
    };
    this.attendanceBySession[input.sessionId].push(created);
    return clone(created);
  }

  async toggleAttendance(sessionId: string, userId: string): Promise<AttendanceRecord | null> {
    this.ensureSessionCollections(sessionId);
    const attendee = this.attendanceBySession[sessionId].find((row) => row.userId === userId);
    if (!attendee) return null;

    attendee.attended = !attendee.attended;
    attendee.checkIn = attendee.attended ? new Date().toISOString() : undefined;
    return clone(attendee);
  }

  async listItems(sessionId: string): Promise<ItemMasterItem[]> {
    this.ensureSessionCollections(sessionId);
    return clone(this.itemsBySession[sessionId]);
  }

  async getItemById(itemId: string): Promise<ItemMasterItem | null> {
    for (const [sessionId, items] of Object.entries(this.itemsBySession)) {
      const found = items.find((row) => row.id === itemId);
      if (!found) continue;
      return clone({
        ...found,
        sessionId
      });
    }
    return null;
  }

  async updateItemCount(input: ItemCountUpdateInput): Promise<ItemMasterItem | null> {
    this.ensureSessionCollections(input.sessionId);
    const item = this.itemsBySession[input.sessionId].find((row) => row.id === input.itemId);
    if (!item) return null;

    item.countQty = input.countQty;
    item.status = resolveStatus(item.sapQty, input.countQty);
    return clone(item);
  }

  async updateItem(input: ItemUpdateInput): Promise<ItemMasterItem | null> {
    this.ensureSessionCollections(input.sessionId);
    const item = this.itemsBySession[input.sessionId].find((row) => row.id === input.itemId);
    if (!item) return null;

    if (input.countQty !== undefined) {
      item.countQty = input.countQty;
      item.status = resolveStatus(item.sapQty, input.countQty);
    }
    if (input.damagedQty !== undefined) item.damagedQty = input.damagedQty;
    if (input.expiredQty !== undefined) item.expiredQty = input.expiredQty;
    if (input.dropped !== undefined) item.dropped = input.dropped;
    if (input.assignedPair !== undefined) item.assignedPair = input.assignedPair ?? "";
    if (input.assignedTo !== undefined) item.assignedTo = input.assignedTo ?? null;
    if (input.adminRemark !== undefined) item.adminRemark = input.adminRemark ?? "";
    return clone(item);
  }

  async bulkAssignItems(input: BulkAssignInput): Promise<{ updated: number }> {
    this.ensureSessionCollections(input.sessionId);
    let updated = 0;
    this.itemsBySession[input.sessionId].forEach((item) => {
      if (!input.itemIds.includes(item.id)) return;
      item.assignedPair = input.pairId ?? "";
      item.assignedTo = input.assignedTo ?? null;
      updated += 1;
    });
    return { updated };
  }

  async getDashboard(sessionId: string): Promise<DashboardSummary> {
    this.ensureSessionCollections(sessionId);
    const items = this.itemsBySession[sessionId].filter((item) => !item.dropped);
    const counted = items.filter((item) => item.countQty !== null).length;
    const pending = items.filter((item) => item.countQty === null).length;

    return {
      totalItems: items.length,
      countedItems: counted,
      pendingItems: pending,
      newItems: this.newItemsBySession[sessionId].length
    };
  }

  async getDashboardDetails(sessionId: string): Promise<DashboardDetails> {
    this.ensureSessionCollections(sessionId);
    const items = this.itemsBySession[sessionId].filter((item) => !item.dropped);

    const summarize = (rows: ItemMasterItem[]) => ({
      total: rows.length,
      counted: rows.filter((item) => item.countQty !== null).length,
      pending: rows.filter((item) => item.countQty === null).length,
      matched: rows.filter((item) => item.status === "Matched").length,
      variance: rows.filter((item) => item.status === "Variance").length,
      notFound: rows.filter((item) => item.countQty === null).length,
      newItems: rows.filter((item) => item.status === "Pending" && item.sapQty === 0).length
    });

    const byGroupMap = new Map<string, ItemMasterItem[]>();
    const byWarehouseMap = new Map<string, ItemMasterItem[]>();
    items.forEach((item) => {
      const groupKey = item.group || "Ungrouped";
      const warehouseKey = item.whCode?.trim() || item.warehouse || "-";
      byGroupMap.set(groupKey, [...(byGroupMap.get(groupKey) ?? []), item]);
      byWarehouseMap.set(warehouseKey, [...(byWarehouseMap.get(warehouseKey) ?? []), item]);
    });

    const byGroup = Array.from(byGroupMap.entries())
      .map(([key, rows]) => ({ key, ...summarize(rows) }))
      .sort((a, b) => a.key.localeCompare(b.key));
    const byWarehouse = Array.from(byWarehouseMap.entries())
      .map(([key, rows]) => ({ key, ...summarize(rows) }))
      .sort((a, b) => a.key.localeCompare(b.key));

    return { byGroup, byWarehouse };
  }

  async listAudit(sessionId: string): Promise<AuditEntry[]> {
    this.ensureSessionCollections(sessionId);
    return clone(this.auditBySession[sessionId]);
  }

  async insertAudit(input: AuditInsertInput): Promise<AuditEntry> {
    this.ensureSessionCollections(input.sessionId);
    const created: AuditEntry = {
      id: `AUD-${Date.now()}`,
      itemCode: input.itemCode,
      itemName: input.itemName,
      submittedBy: input.submittedBy,
      qty: input.qty,
      countedAt: new Date().toISOString(),
      warehouse: input.warehouse,
      remark: input.remark
    };
    this.auditBySession[input.sessionId].unshift(created);
    return clone(created);
  }

  async listNewItems(sessionId: string): Promise<NewItemRecord[]> {
    this.ensureSessionCollections(sessionId);
    return clone(this.newItemsBySession[sessionId]);
  }

  async createNewItem(input: NewItemInput): Promise<NewItemRecord> {
    this.ensureSessionCollections(input.sessionId);
    const createdAt = new Date().toISOString();
    const qty = input.qty ?? null;
    const damagedQty = input.damagedQty ?? null;
    const expiredQty = input.expiredQty ?? null;
    const remark = input.remark?.trim() || null;
    const photos = input.photos?.filter((photo) => photo.trim().length > 0) ?? [];
    const created: NewItemRecord = {
      id: `NEW-${Date.now()}`,
      sessionId: input.sessionId,
      code: input.code,
      name: input.name,
      uom: input.uom?.trim() || null,
      batch: input.batch?.trim() || null,
      status: "Pending",
      submittedBy: input.submittedBy,
      warehouse: input.warehouse ?? null,
      qty,
      damagedQty,
      expiredQty,
      remark,
      photos,
      createdAt,
      checkerStatus: "Pending"
    };
    this.newItemsBySession[input.sessionId].unshift(created);
    this.itemsBySession[input.sessionId].unshift({
      id: created.id,
      sessionId: input.sessionId,
      code: created.code,
      name: created.name,
      batch: created.batch ?? null,
      uom: created.uom ?? undefined,
      packagingSize: null,
      expiryDate: null,
      category: null,
      warehouse: created.warehouse ?? "-",
      whCode: null,
      sapQty: 0,
      countQty: qty,
      stagedCountQty: null,
      damagedQty,
      expiredQty,
      dropped: false,
      status: "Pending",
      countStatus: "New item",
      newItem: "Yes",
      source: "Warehouse",
      assignedPair: "",
      assignedTo: null,
      submittedBy: input.submittedBy,
      remark: remark,
      adminRemark: "",
      checkerStatus: "Pending",
      photos
    });
    return clone(created);
  }

  async updateNewItemStatus(itemId: string, status: NewItemRecord["status"]): Promise<NewItemRecord | null> {
    for (const [sessionId, rows] of Object.entries(this.newItemsBySession)) {
      const row = rows.find((candidate) => candidate.id === itemId);
      if (!row) continue;
      row.status = status;
      const linkedItem = this.itemsBySession[sessionId].find((item) => item.id === itemId);
      if (linkedItem) {
        linkedItem.checkerStatus = status;
      }
      this.newItemsBySession[sessionId] = rows;
      return clone(row);
    }
    return null;
  }

  async listApprovals(sessionId: string): Promise<ApprovalRecord[]> {
    this.ensureSessionCollections(sessionId);
    return clone(this.approvalsBySession[sessionId]);
  }

  async actOnApproval(input: ApprovalActionInput): Promise<ApprovalRecord | null> {
    this.ensureSessionCollections(input.sessionId);
    const target = this.approvalsBySession[input.sessionId].find((row) => row.id === input.approvalId);
    if (!target) return null;

    if (target.status !== "Pending") {
      const error = new Error(`Approval record has already been reviewed as ${target.status}`) as Error & { code?: string };
      error.code = "P0001";
      throw error;
    }

    target.status = input.action;
    target.reviewedBy = input.reviewedBy;
    target.reviewedAt = new Date().toISOString();

    if (input.action === "Approved") {
      const item = this.itemsBySession[input.sessionId].find((row) => row.code === target.itemCode);
      if (!item) {
        const error = new Error("Item not found for approval") as Error & { code?: string };
        error.code = "P0002";
        throw error;
      }

      const currentQty = item.countQty ?? 0;
      const oldQty = Number(target.oldQty ?? 0);
      const newQty = Number(target.newQty ?? 0);
      const adjustedQty = currentQty - oldQty + newQty;
      const approvedBin = target.newBin?.trim() || target.oldBin?.trim() || item.warehouse;

      item.countQty = adjustedQty;
      item.status = resolveStatus(item.sapQty, adjustedQty);
      item.warehouse = approvedBin || item.warehouse;

      const baseRemark = `Approved by ${input.reviewedBy}: ${oldQty} -> ${newQty} (adjusted: ${adjustedQty})`;
      const remark =
        target.oldBin && approvedBin && target.oldBin !== approvedBin
          ? `${baseRemark}; bin ${target.oldBin} -> ${approvedBin}`
          : baseRemark;

      this.auditBySession[input.sessionId].unshift({
        id: `AUD-${Date.now()}`,
        itemCode: target.itemCode,
        itemName: target.itemName,
        submittedBy: target.submittedBy,
        qty: adjustedQty,
        countedAt: new Date().toISOString(),
        warehouse: approvedBin || undefined,
        remark
      });
    }

    return clone(target);
  }

  async listBins(): Promise<string[]> {
    const binSet = new Set<string>();
    for (const rows of Object.values(this.itemsBySession)) {
      for (const item of rows) {
        if (item.warehouse) binSet.add(item.warehouse);
      }
    }
    return Array.from(binSet).sort();
  }

  async listWhCodes(sessionId?: string): Promise<string[]> {
    const codeSet = new Set<string>();
    const entries = sessionId
      ? (this.itemsBySession[sessionId] ? [[sessionId, this.itemsBySession[sessionId]]] : [])
      : Object.entries(this.itemsBySession);
    for (const [, rows] of entries as [string, typeof this.itemsBySession[string]][]) {
      for (const item of rows) {
        if (item.whCode) codeSet.add(item.whCode);
      }
    }
    return Array.from(codeSet).sort();
  }

  async searchWarehouseItems(query: string, sessionId?: string): Promise<WarehouseItem[]> {
    const allItems = Object.entries(this.itemsBySession).flatMap(([sid, rows]) =>
      rows.map((row) => ({ sessionId: sid, ...row }))
    );
    const lowerQuery = query.trim().toLowerCase();

    const mapped: WarehouseItem[] = allItems
      .filter((item) => !item.dropped && (!sessionId || item.sessionId === sessionId))
      .map((item) => ({
      id: item.id,
      sessionId: item.sessionId,
      code: item.code,
      name: item.name,
      warehouse: item.warehouse,
      assignedTo: item.assignedTo ?? item.assignedPair,
      sapQty: item.sapQty,
      countQty: item.countQty,
      photos: item.photos ?? [],
      batch: item.batch ?? null
      }));

    if (!lowerQuery) {
      return clone(mapped);
    }

    return clone(
      mapped.filter(
        (item) =>
          item.code.toLowerCase().includes(lowerQuery) ||
          item.name.toLowerCase().includes(lowerQuery) ||
          item.warehouse.toLowerCase().includes(lowerQuery) ||
          (item.batch && item.batch.toLowerCase().includes(lowerQuery))
      )
    );
  }

  async listAssignedItems(input?: { assignee?: string; userName?: string }): Promise<WarehouseItem[]> {
    const allItems = Object.entries(this.itemsBySession).flatMap(([sessionId, rows]) =>
      rows.map((row) => ({ sessionId, ...row }))
    );
    const assignee = input?.assignee?.trim() ?? "";
    const normalizedUserName = input?.userName?.trim() ? normalizeName(input.userName) : "";
    return clone(
      allItems
        .filter((item) => !item.dropped)
        .filter((item) => {
          if (assignee) {
            return item.assignedPair === assignee || item.assignedTo === assignee;
          }

          if (normalizedUserName) {
            const directAssigned =
              typeof item.assignedTo === "string" && normalizeName(item.assignedTo).includes(normalizedUserName);
            if (directAssigned) return true;

            const pair = this.pairsBySession[item.sessionId]?.find((entry) => entry.id === item.assignedPair);
            if (!pair) return false;
            return [pair.counter, pair.checker, pair.counter2]
              .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
              .some((member) => normalizeName(member) === normalizedUserName);
          }

          return Boolean(item.assignedPair || item.assignedTo);
        })
        .map((item) => ({
          id: item.id,
          sessionId: item.sessionId,
          code: item.code,
          name: item.name,
          warehouse: item.warehouse,
          assignedTo: item.assignedTo ?? item.assignedPair,
          sapQty: item.sapQty,
          countQty: item.countQty,
          photos: item.photos ?? []
        }))
    );
  }

  async submitCount(input: CountSubmissionInput): Promise<void> {
    const sessionEntries = Object.entries(this.itemsBySession);
    for (const [sessionId, items] of sessionEntries) {
      const item = items.find((candidate) => candidate.id === input.itemId);
      if (!item) continue;

      item.countQty = input.qty;
      item.damagedQty = input.damagedQty ?? null;
      item.expiredQty = input.expiredQty ?? null;
      item.submittedBy = input.submittedBy;
      item.status = resolveStatus(item.sapQty, input.qty);

      this.auditBySession[sessionId].unshift({
        id: `AUD-${Date.now()}`,
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        submittedBy: input.submittedBy,
        qty: input.qty,
        countedAt: new Date().toISOString(),
        damagedQty: input.damagedQty ?? null,
        expiredQty: input.expiredQty ?? null,
        warehouse: item.warehouse,
        remark: input.remark
      });
      return;
    }
  }

  async listCountHistory(filters?: { submittedBy?: string; sessionId?: string }): Promise<CountHistoryEntry[]> {
    const submittedBy = filters?.submittedBy;
    const sessionId = filters?.sessionId;
    const sessionMap = new Map(this.sessions.map((session) => [session.id, session.name]));
    const rows = Object.entries(this.auditBySession).flatMap(([sessionId, entries]) =>
      entries.map((entry) => ({
        id: entry.id,
        itemId: entry.itemId,
        sessionId,
        sessionName: sessionMap.get(sessionId) ?? sessionId,
        itemCode: entry.itemCode,
        itemName: entry.itemName,
        qty: entry.qty,
        countedAt: entry.countedAt,
        submittedBy: entry.submittedBy,
        remark: entry.remark
      }))
    );

    const filtered = rows
      .filter((row) => (submittedBy ? row.submittedBy.toLowerCase().includes(submittedBy.toLowerCase()) : true))
      .filter((row) => (sessionId ? row.sessionId === sessionId : true));
    return clone(filtered.sort((a, b) => b.countedAt.localeCompare(a.countedAt)));
  }

  async listUsers(): Promise<UserRoleRecord[]> {
    return clone(this.users);
  }

  async findUserByEmail(email: string): Promise<UserRoleRecord | null> {
    const target = this.users.find((row) => (row.email ?? "").toLowerCase() === email.trim().toLowerCase()) ?? null;
    return clone(target);
  }

  async updateUserRole(userId: string, role: UserRoleRecord["role"]): Promise<UserRoleRecord | null> {
    const user = this.users.find((row) => row.id === userId);
    if (!user) return null;
    user.role = role;
    return clone(user);
  }

  async resetSessionAssignments(sessionId: string): Promise<{
    pairsDeleted: number;
    attendanceDeleted: number;
    itemsUnassigned: number;
  }> {
    this.ensureSessionCollections(sessionId);

    const pairsDeleted = this.pairsBySession[sessionId].length;
    const attendanceDeleted = this.attendanceBySession[sessionId].length;

    this.pairsBySession[sessionId] = [];
    this.attendanceBySession[sessionId] = [];

    let itemsUnassigned = 0;
    this.itemsBySession[sessionId] = this.itemsBySession[sessionId].map((item) => {
      const hadAssignment = Boolean(item.assignedPair?.trim() || item.assignedTo?.trim());
      if (hadAssignment) {
        itemsUnassigned += 1;
      }
      return {
        ...item,
        assignedPair: "",
        assignedTo: null
      };
    });

    return { pairsDeleted, attendanceDeleted, itemsUnassigned };
  }

  async importWebhookPayload(payload: WebhookImportPayload): Promise<{ imported: number }> {
    if (payload.source === "bins") {
      const uniqueBins = new Set<string>();
      payload.data.forEach((entry) => {
        const row = entry as Record<string, unknown>;
        const id = String(row.bin_location ?? row.id ?? "").trim();
        if (!id) return;
        uniqueBins.add(id);
      });
      return { imported: uniqueBins.size };
    }

    if (payload.source === "users") {
      const privilegedRoleById = new Map<string, UserRoleRecord["role"]>();
      const privilegedRoleByEmail = new Map<string, UserRoleRecord["role"]>();
      const privilegedUsers = this.users.filter((user) => user.role === "Admin" || user.role === "Super Admin");

      privilegedUsers.forEach((user) => {
        privilegedRoleById.set(user.id, user.role);
        const normalizedEmail = user.email?.trim().toLowerCase();
        if (normalizedEmail) {
          privilegedRoleByEmail.set(normalizedEmail, user.role);
        }
      });

      const seenById = new Map<string, UserRoleRecord>();
      const seenEmails = new Set<string>();

      payload.data.forEach((entry) => {
        const row = entry as Record<string, unknown>;
        const id = String(row.id ?? randomUUID());
        const emailRaw = row.email_address ? String(row.email_address) : row.email ? String(row.email) : null;
        const normalizedEmail = emailRaw?.trim().toLowerCase() || null;
        if (normalizedEmail && seenEmails.has(normalizedEmail)) {
          return;
        }

        const preservedRole = privilegedRoleById.get(id) ?? (normalizedEmail ? privilegedRoleByEmail.get(normalizedEmail) : undefined);
        const mapped: UserRoleRecord = {
          id,
          name: String(row.display_name ?? row.name ?? row.full_name ?? ""),
          email: normalizedEmail,
          role: preservedRole ?? "User",
          country: row.country === "Singapore" ? "Singapore" : row.country === "Malaysia" ? "Malaysia" : null,
          accountEnabled: typeof row.account_enabled === "boolean" ? row.account_enabled : true
        };

        seenById.set(id, mapped);
        if (normalizedEmail) {
          seenEmails.add(normalizedEmail);
        }
      });

      const mapped = Array.from(seenById.values());
      privilegedUsers.forEach((user) => {
        const normalizedEmail = user.email?.trim().toLowerCase() ?? null;
        const alreadyPresent = mapped.some(
          (row) => row.id === user.id || (normalizedEmail ? row.email?.toLowerCase() === normalizedEmail : false)
        );
        if (alreadyPresent) return;
        mapped.push({
          id: user.id,
          name: user.name,
          email: normalizedEmail,
          role: user.role,
          country: user.country ?? null,
          accountEnabled: user.accountEnabled ?? true
        });
      });

      this.users = mapped;
      return { imported: mapped.length };
    }

    if (payload.source === "items") {
      if (!payload.sessionId) {
        return { imported: 0 };
      }

      const mappedById = new Map<string, ItemMasterItem>();
      payload.data.forEach((row) => {
        const anyRow = row as Record<string, unknown>;
        const id = String(anyRow.ItemInternalId ?? anyRow.id ?? randomUUID());
        const sapQtyRaw = anyRow.sap_qty ?? anyRow.sapQty ?? anyRow.sap ?? 0;
        const sapQty = Number.isFinite(Number(sapQtyRaw)) ? Number(sapQtyRaw) : 0;
        const binLocation =
          firstNonEmptyString(anyRow, ["item_location", "itemLocation", "bin_location", "binLocation", "warehouse", "location"]) ?? "";
        const whCode =
          firstNonEmptyString(anyRow, ["wh_code", "whCode", "warehouse_code", "warehouseCode", "wh", "warehouse_id"]) ?? null;

        const mappedRow: ItemMasterItem = {
          id,
          sessionId: payload.sessionId,
          code: String(anyRow.item_code ?? anyRow.code ?? ""),
          name: String(anyRow.item_name ?? anyRow.name ?? ""),
          group: String(anyRow.item_group ?? anyRow.group ?? anyRow.grp ?? ""),
          batch: anyRow.batch_serial_num ? String(anyRow.batch_serial_num) : anyRow.batch ? String(anyRow.batch) : null,
          uom: anyRow.uom ? String(anyRow.uom) : "PCS",
          packagingSize: anyRow.packaging_size ? String(anyRow.packaging_size) : anyRow.pkg ? String(anyRow.pkg) : null,
          expiryDate: anyRow.expiry_date ? String(anyRow.expiry_date).slice(0, 10) : null,
          category: anyRow.category ? String(anyRow.category) : null,
          warehouse: binLocation,
          whCode,
          sapQty,
          countQty: null,
          stagedCountQty: null,
          dropped: false,
          status: "Pending",
          countStatus:
            anyRow.item_status && String(anyRow.item_status).trim().length > 0
              ? String(anyRow.item_status)
              : sapQty === 0
              ? "New item"
              : "Pending",
          newItem: anyRow.new_item === "Yes" ? "Yes" : sapQty === 0 ? "Yes" : "No",
          source: anyRow.src ? String(anyRow.src) : "SAP",
          assignedPair: "",
          assignedTo: null,
          submittedBy: null,
          remark: anyRow.remark ? String(anyRow.remark) : null,
          adminRemark: ""
        };
        mappedById.set(id, mappedRow);
      });

      const mapped = Array.from(mappedById.values());

      this.itemsBySession[payload.sessionId] = mapped;
      return { imported: mapped.length };
    }

    return { imported: 0 };
  }
}

export function createInMemoryStaRepository(): InMemoryStaRepository {
  return new InMemoryStaRepository();
}
