import type {
  ApprovalRecord,
  AttendanceScanResult,
  AttendanceRecord,
  AuditEntry,
  BulkAssignInput,
  CountHistoryEntry,
  CountSubmissionInput,
  DashboardDetails,
  DashboardSummary,
  ItemMasterItem,
  ItemUpdateInput,
  NewItemRecord,
  NewSessionInput,
  PairAssignment,
  Session,
  UserRoleRecord,
  WarehouseItem
} from "../types/domain";

const delay = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));

const now = new Date().toISOString();

const sessions: Session[] = [
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
    strictRoles: false,
    createdBy: "Admin User"
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
    strictRoles: false,
    createdBy: "Admin User"
  }
];

const pairsBySession: Record<string, PairAssignment[]> = {
  "YE2026-MY-001": [
    { id: "P-01", counter: "Ahmad Hassan", checker: "Siti Che", warehouse: "A-01", role: "User" },
    { id: "P-02", counter: "Jarvis Ng", checker: "Lim Eng", counter2: "Nur Ain", warehouse: "B-02", role: "Admin" }
  ],
  "CC2026-SG-001": [{ id: "P-11", counter: "Ryan Tan", checker: "Jia Wei", warehouse: "S-01", role: "User" }]
};

const attendanceBySession: Record<string, AttendanceRecord[]> = {
  "YE2026-MY-001": [
    { userId: "U-001", name: "Ahmad Hassan", attended: true, checkIn: now },
    { userId: "U-002", name: "Siti Che", attended: true, checkIn: now },
    { userId: "U-003", name: "Jarvis Ng", attended: false }
  ],
  "CC2026-SG-001": [{ userId: "U-101", name: "Ryan Tan", attended: true, checkIn: now }]
};

const itemsBySession: Record<string, ItemMasterItem[]> = {
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

const auditBySession: Record<string, AuditEntry[]> = {
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

const newItemsBySession: Record<string, NewItemRecord[]> = {
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

const approvalsBySession: Record<string, ApprovalRecord[]> = {
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

const users: UserRoleRecord[] = [
  {
    id: "U-ADMIN-1",
    name: "Admin User",
    email: "admin@example.com",
    role: "Admin",
    accountEnabled: true
  },
  {
    id: "U-CNT-1",
    name: "Counter User",
    email: "counter@example.com",
    role: "User",
    accountEnabled: true
  },
  {
    id: "U-SP-1",
    name: "Super Admin",
    email: "superadmin@example.com",
    role: "Super Admin",
    accountEnabled: true
  }
];

function clone<T>(value: T): T {
  return structuredClone(value);
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

const seedSnapshot = {
  sessions: clone(sessions),
  pairsBySession: clone(pairsBySession),
  attendanceBySession: clone(attendanceBySession),
  itemsBySession: clone(itemsBySession),
  auditBySession: clone(auditBySession),
  newItemsBySession: clone(newItemsBySession),
  approvalsBySession: clone(approvalsBySession),
  users: clone(users)
};

function resetRecord<T extends Record<string, unknown>>(target: T, source: T): void {
  for (const key of Object.keys(target)) {
    delete target[key];
  }
  Object.assign(target, clone(source));
}

function nextSessionId(country: Session["country"], type: Session["type"], isRecount: boolean): string {
  const yy = new Date().getFullYear();
  const typeCode = isRecount ? "RC" : type === "Year End" ? "YE" : "CC";
  const countryCode = country === "Malaysia" ? "MY" : "SG";
  const prefix = `${typeCode}${yy}-${countryCode}-`;
  const seq = sessions.filter((s) => s.id.startsWith(prefix)).length + 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

function ensureSessionCollections(sessionId: string): void {
  if (!pairsBySession[sessionId]) pairsBySession[sessionId] = [];
  if (!attendanceBySession[sessionId]) attendanceBySession[sessionId] = [];
  if (!itemsBySession[sessionId]) itemsBySession[sessionId] = [];
  if (!auditBySession[sessionId]) auditBySession[sessionId] = [];
  if (!newItemsBySession[sessionId]) newItemsBySession[sessionId] = [];
  if (!approvalsBySession[sessionId]) approvalsBySession[sessionId] = [];
}

export const mockStore = {
  async listSessions(): Promise<Session[]> {
    await delay();
    return clone(sessions);
  },

  async createSession(input: NewSessionInput): Promise<Session> {
    await delay();
    const isRecount = Boolean(input.isRecount);
    const created: Session = {
      id: nextSessionId(input.country, input.type, isRecount),
      ...input,
      status: "Draft",
      progress: 0,
      isRecount,
      parentId: isRecount ? input.parentId ?? null : null,
      userVisible: input.userVisible ?? false,
      strictRoles: false,
      createdBy: "Admin User"
    };
    sessions.unshift(created);
    ensureSessionCollections(created.id);
    return clone(created);
  },

  async updateSession(sessionId: string, input: NewSessionInput): Promise<Session | null> {
    await delay();
    const target = sessions.find((session) => session.id === sessionId);
    if (!target) return null;

    target.name = input.name;
    target.type = input.type;
    target.country = input.country;
    target.entity = input.entity;
    target.startDate = input.startDate;
    target.endDate = input.endDate;
    target.isRecount = Boolean(input.isRecount);
    target.parentId = target.isRecount ? input.parentId ?? null : null;
    return clone(target);
  },

  async reopenSession(sessionId: string): Promise<Session | null> {
    await delay();
    const target = sessions.find((session) => session.id === sessionId);
    if (!target) return null;
    target.status = "Active";
    return clone(target);
  },

  async endSession(sessionId: string): Promise<Session | null> {
    await delay();
    const target = sessions.find((session) => session.id === sessionId);
    if (!target) return null;
    target.status = "Closed";
    target.progress = 100;
    return clone(target);
  },

  async toggleSessionVisibility(sessionId: string): Promise<Session | null> {
    await delay();
    const target = sessions.find((session) => session.id === sessionId);
    if (!target) return null;
    target.userVisible = !target.userVisible;
    target.status = target.userVisible ? "Active" : "Draft";
    return clone(target);
  },

  async toggleStrictRoles(sessionId: string): Promise<Session | null> {
    await delay();
    const target = sessions.find((session) => session.id === sessionId);
    if (!target) return null;
    target.strictRoles = !target.strictRoles;
    return clone(target);
  },

  async deleteSession(sessionId: string): Promise<boolean> {
    await delay();
    const index = sessions.findIndex((session) => session.id === sessionId);
    if (index === -1) return false;
    sessions.splice(index, 1);
    delete pairsBySession[sessionId];
    delete attendanceBySession[sessionId];
    delete itemsBySession[sessionId];
    delete auditBySession[sessionId];
    delete newItemsBySession[sessionId];
    delete approvalsBySession[sessionId];
    return true;
  },

  async getSession(sessionId: string): Promise<Session | null> {
    await delay();
    const found = sessions.find((session) => session.id === sessionId) ?? null;
    return clone(found);
  },

  async listPairs(sessionId: string): Promise<PairAssignment[]> {
    await delay();
    ensureSessionCollections(sessionId);
    return clone(pairsBySession[sessionId]);
  },

  async createPair(sessionId: string, input: Omit<PairAssignment, "id">): Promise<PairAssignment> {
    await delay();
    ensureSessionCollections(sessionId);
    const created: PairAssignment = {
      id: `P-${Date.now()}`,
      ...input
    };
    pairsBySession[sessionId].push(created);
    return clone(created);
  },

  async updatePair(pairId: string, sessionId: string, input: Omit<PairAssignment, "id">): Promise<PairAssignment | null> {
    await delay();
    ensureSessionCollections(sessionId);
    const row = pairsBySession[sessionId].find((pair) => pair.id === pairId);
    if (!row) return null;
    row.counter = input.counter;
    row.checker = input.checker;
    row.counter2 = input.counter2;
    row.warehouse = input.warehouse;
    row.role = input.role;
    return clone(row);
  },

  async deletePair(pairId: string): Promise<boolean> {
    await delay();
    for (const [sessionId, rows] of Object.entries(pairsBySession)) {
      const before = rows.length;
      pairsBySession[sessionId] = rows.filter((row) => row.id !== pairId);
      if (pairsBySession[sessionId].length !== before) return true;
    }
    return false;
  },

  async listAttendance(sessionId: string): Promise<AttendanceRecord[]> {
    await delay();
    ensureSessionCollections(sessionId);
    return clone(attendanceBySession[sessionId]);
  },

  async upsertAttendance(input: AttendanceRecord & { sessionId: string }): Promise<AttendanceRecord> {
    await delay();
    ensureSessionCollections(input.sessionId);
    const existing = attendanceBySession[input.sessionId].find((row) => row.userId === input.userId);
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
    attendanceBySession[input.sessionId].push(created);
    return clone(created);
  },

  async toggleAttendance(sessionId: string, userId: string): Promise<AttendanceRecord | null> {
    await delay();
    ensureSessionCollections(sessionId);
    const attendee = attendanceBySession[sessionId].find((row) => row.userId === userId);
    if (!attendee) return null;
    attendee.attended = !attendee.attended;
    attendee.checkIn = attendee.attended ? new Date().toISOString() : undefined;
    return clone(attendee);
  },

  async listItems(sessionId: string): Promise<ItemMasterItem[]> {
    await delay();
    ensureSessionCollections(sessionId);
    return clone(itemsBySession[sessionId]);
  },

  async updateItemCount(sessionId: string, itemId: string, countQty: number): Promise<ItemMasterItem | null> {
    await delay();
    ensureSessionCollections(sessionId);
    const item = itemsBySession[sessionId].find((row) => row.id === itemId);
    if (!item) return null;
    item.countQty = countQty;
    item.status = item.sapQty === countQty ? "Matched" : "Variance";
    return clone(item);
  },

  async updateItem(input: ItemUpdateInput): Promise<ItemMasterItem | null> {
    await delay();
    ensureSessionCollections(input.sessionId);
    const item = itemsBySession[input.sessionId].find((row) => row.id === input.itemId);
    if (!item) return null;
    if (input.countQty !== undefined) {
      item.countQty = input.countQty;
      item.status = item.countQty === null ? "Pending" : item.sapQty === item.countQty ? "Matched" : "Variance";
    }
    if (input.damagedQty !== undefined) item.damagedQty = input.damagedQty;
    if (input.expiredQty !== undefined) item.expiredQty = input.expiredQty;
    if (input.dropped !== undefined) item.dropped = input.dropped;
    if (input.assignedPair !== undefined) item.assignedPair = input.assignedPair ?? "";
    if (input.assignedTo !== undefined) item.assignedTo = input.assignedTo ?? null;
    if (input.adminRemark !== undefined) item.adminRemark = input.adminRemark ?? "";
    return clone(item);
  },

  async bulkAssignItems(input: BulkAssignInput): Promise<{ updated: number }> {
    await delay();
    ensureSessionCollections(input.sessionId);
    let updated = 0;
    itemsBySession[input.sessionId].forEach((item) => {
      if (!input.itemIds.includes(item.id)) return;
      item.assignedPair = input.pairId ?? "";
      item.assignedTo = input.assignedTo ?? input.pairId ?? null;
      updated += 1;
    });
    return { updated };
  },

  async getDashboard(sessionId: string): Promise<DashboardSummary> {
    await delay();
    ensureSessionCollections(sessionId);
    const items = itemsBySession[sessionId].filter((item) => !item.dropped);
    const counted = items.filter((item) => item.countQty !== null).length;
    const pending = items.filter((item) => item.countQty === null).length;
    return {
      totalItems: items.length,
      countedItems: counted,
      pendingItems: pending,
      newItems: newItemsBySession[sessionId].length
    };
  },

  async getDashboardDetails(sessionId: string): Promise<DashboardDetails> {
    await delay();
    ensureSessionCollections(sessionId);
    const items = itemsBySession[sessionId].filter((item) => !item.dropped);

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
  },

  async listAudit(sessionId: string): Promise<AuditEntry[]> {
    await delay();
    ensureSessionCollections(sessionId);
    return clone(auditBySession[sessionId]);
  },

  async listNewItems(sessionId: string): Promise<NewItemRecord[]> {
    await delay();
    ensureSessionCollections(sessionId);
    return clone(newItemsBySession[sessionId]);
  },

  async createNewItem(input: {
    sessionId: string;
    code: string;
    name: string;
    warehouse?: string;
    uom?: string;
    batch?: string;
    qty?: number | null;
    damagedQty?: number | null;
    expiredQty?: number | null;
    remark?: string;
    photos?: string[];
    submittedBy: string;
  }): Promise<NewItemRecord> {
    await delay();
    ensureSessionCollections(input.sessionId);
    const createdAt = new Date().toISOString();
    const qty = input.qty ?? null;
    const damagedQty = input.damagedQty ?? null;
    const expiredQty = input.expiredQty ?? null;
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
      remark: input.remark?.trim() || null,
      photos,
      createdAt,
      checkerStatus: "Pending"
    };
    newItemsBySession[input.sessionId].unshift(created);
    itemsBySession[input.sessionId].unshift({
      id: created.id,
      sessionId: input.sessionId,
      code: input.code,
      name: input.name,
      batch: created.batch ?? null,
      uom: created.uom ?? undefined,
      packagingSize: null,
      expiryDate: null,
      category: null,
      warehouse: input.warehouse ?? "-",
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
      remark: input.remark?.trim() || null,
      adminRemark: "",
      checkerStatus: "Pending",
      photos
    });
    return clone(created);
  },

  async updateNewItemStatus(itemId: string, status: NewItemRecord["status"]): Promise<NewItemRecord | null> {
    await delay();
    for (const [sessionId, rows] of Object.entries(newItemsBySession)) {
      const row = rows.find((candidate) => candidate.id === itemId);
      if (!row) continue;
      row.status = status;
      const itemRow = itemsBySession[sessionId]?.find((item) => item.id === itemId);
      if (itemRow) {
        itemRow.status = itemRow.countQty === null ? "Pending" : itemRow.sapQty === itemRow.countQty ? "Matched" : "Variance";
        itemRow.checkerStatus = status === "Pending" ? "Pending" : status;
      }
      newItemsBySession[sessionId] = rows;
      return clone(row);
    }
    return null;
  },

  async listApprovals(sessionId: string): Promise<ApprovalRecord[]> {
    await delay();
    ensureSessionCollections(sessionId);
    return clone(approvalsBySession[sessionId]);
  },

  async reviewApproval(sessionId: string, approvalId: string, status: "Approved" | "Rejected"): Promise<ApprovalRecord | null> {
    await delay();
    ensureSessionCollections(sessionId);
    const target = approvalsBySession[sessionId].find((row) => row.id === approvalId);
    if (!target) return null;
    target.status = status;
    target.reviewedBy = "Admin";
    target.reviewedAt = new Date().toISOString();
    return clone(target);
  },

  async searchWarehouseItems(query: string): Promise<WarehouseItem[]> {
    await delay();
    const allItems = Object.entries(itemsBySession).flatMap(([sessionId, rows]) => rows.map((item) => ({ sessionId, ...item })));
    const lowerQuery = query.trim().toLowerCase();
    const mapped: WarehouseItem[] = allItems
      .filter((item) => !item.dropped)
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
      }));
    if (!lowerQuery) return clone(mapped);
    return clone(
      mapped.filter(
        (item) =>
          item.code.toLowerCase().includes(lowerQuery) ||
          item.name.toLowerCase().includes(lowerQuery) ||
          item.warehouse.toLowerCase().includes(lowerQuery)
      )
    );
  },

  async listAssignedItems(assignee?: string, sessionId?: string, userName?: string): Promise<WarehouseItem[]> {
    await delay();
    const allItems = Object.entries(itemsBySession).flatMap(([sessionId, rows]) => rows.map((item) => ({ sessionId, ...item })));
    const normalizedUserName = userName?.trim() ? normalizeName(userName) : "";
    const normalizedAssignee = assignee?.trim() ?? "";
    return clone(
      allItems
        .filter((item) => !item.dropped)
        .filter((item) => (!sessionId ? true : item.sessionId === sessionId))
        .filter((item) => {
          if (normalizedAssignee) {
            return item.assignedPair === normalizedAssignee || item.assignedTo === normalizedAssignee;
          }

          if (normalizedUserName) {
            const directAssigned =
              typeof item.assignedTo === "string" && normalizeName(item.assignedTo).includes(normalizedUserName);
            if (directAssigned) return true;

            const pairRows = pairsBySession[item.sessionId] ?? [];
            const pair = pairRows.find((entry) => entry.id === item.assignedPair);
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
  },

  async submitCount(input: CountSubmissionInput): Promise<void> {
    await delay();
    const allSessionEntries = Object.entries(itemsBySession);
    for (const [sessionId, items] of allSessionEntries) {
      const item = items.find((candidate) => candidate.id === input.itemId);
      if (!item) continue;
      item.countQty = input.qty;
      item.damagedQty = input.damagedQty ?? null;
      item.expiredQty = input.expiredQty ?? null;
      item.submittedBy = input.submittedBy;
      item.status = item.sapQty === input.qty ? "Matched" : "Variance";
      auditBySession[sessionId].unshift({
        id: `AUD-${Date.now()}`,
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
  },

  async importItemsFromSap(input: {
    sessionId: string;
    entity?: string;
    data?: Record<string, unknown>[];
  }): Promise<{ imported: number; received: number }> {
    await delay();
    ensureSessionCollections(input.sessionId);
    const sourceRows =
      input.data && input.data.length > 0
        ? input.data
        : [
            {
              id: `SAP-${Date.now()}-1`,
              code: "ITM-7001",
              name: `Imported SAP Item (${input.entity ?? "ALL"})`,
              item_group: "Imported",
              item_location: "SAP-01",
              sap_qty: 25
            },
            {
              id: `SAP-${Date.now()}-2`,
              code: "ITM-7002",
              name: `Imported SAP Item 2 (${input.entity ?? "ALL"})`,
              item_group: "Imported",
              item_location: "SAP-02",
              sap_qty: 9
            }
          ];

    const mapped: ItemMasterItem[] = sourceRows.map((row, index) => {
      const itemId = String(row.ItemInternalId ?? row.id ?? `SAP-${Date.now()}-${index}`);
      const sapQtyRaw = row.sap_qty ?? row.sapQty ?? row.sap ?? 0;
      const sapQty = Number.isFinite(Number(sapQtyRaw)) ? Number(sapQtyRaw) : 0;
      return {
        id: itemId,
        sessionId: input.sessionId,
        code: String(row.item_code ?? row.code ?? `SAP-${index + 1}`),
        name: String(row.item_name ?? row.name ?? `Imported Item ${index + 1}`),
        group: String(row.item_group ?? row.group ?? row.grp ?? ""),
        batch: row.batch_serial_num ? String(row.batch_serial_num) : row.batch ? String(row.batch) : null,
        uom: row.uom ? String(row.uom) : "PCS",
        packagingSize: row.packaging_size ? String(row.packaging_size) : row.pkg ? String(row.pkg) : null,
        expiryDate: row.expiry_date ? String(row.expiry_date).slice(0, 10) : null,
        category: row.category ? String(row.category) : null,
        warehouse: String(row.item_location ?? row.bin_location ?? row.warehouse ?? ""),
        whCode: row.wh_code ? String(row.wh_code) : null,
        sapQty,
        countQty: null,
        stagedCountQty: null,
        dropped: false,
        status: "Pending",
        countStatus:
          row.item_status && String(row.item_status).trim().length > 0
            ? String(row.item_status)
            : sapQty === 0
            ? "New item"
            : "Pending",
        newItem: row.new_item === "Yes" ? "Yes" : sapQty === 0 ? "Yes" : "No",
        source: row.src ? String(row.src) : "SAP",
        assignedPair: "",
        assignedTo: null,
        submittedBy: null,
        remark: row.remark ? String(row.remark) : null,
        adminRemark: ""
      };
    });

    itemsBySession[input.sessionId] = mapped;
    newItemsBySession[input.sessionId] = mapped
      .filter((item) => item.sapQty === 0)
      .map((item) => ({
        id: item.id,
        sessionId: input.sessionId,
        code: item.code,
        name: item.name,
        status: "Pending",
        submittedBy: "SAP Import",
        warehouse: item.warehouse,
        qty: item.countQty,
        damagedQty: item.damagedQty ?? null,
        expiredQty: item.expiredQty ?? null,
        remark: null,
        photos: [],
        createdAt: new Date().toISOString(),
        checkerStatus: item.checkerStatus ?? null
      }));

    return {
      imported: mapped.length,
      received: sourceRows.length
    };
  },

  async importBinsFromPa(input?: { data?: Record<string, unknown>[] }): Promise<{ imported: number; received: number }> {
    await delay();
    const sourceRows =
      input?.data && input.data.length > 0
        ? input.data
        : [
            { id: "A-01", bin_location: "A-01", location_assigned: "Area A" },
            { id: "B-02", bin_location: "B-02", location_assigned: "Area B" },
            { id: "C-03", bin_location: "C-03", location_assigned: "Area C" }
          ];

    return {
      imported: sourceRows.length,
      received: sourceRows.length
    };
  },

  async importUsersFromPa(input?: {
    sessionId?: string;
    resetSessionAssignments?: boolean;
    data?: Record<string, unknown>[];
  }): Promise<{
    imported: number;
    received: number;
    reset?: { pairsDeleted: number; attendanceDeleted: number; itemsUnassigned: number };
  }> {
    await delay();

    const sourceRows =
      input?.data && input.data.length > 0
        ? input.data
        : users.map((user) => ({
            id: user.id,
            display_name: user.name,
            email_address: user.email,
            role: user.role
          }));

    const mappedUsers: UserRoleRecord[] = sourceRows.map((row, index) => {
      const record = row as Record<string, unknown>;
      const rawRole = String(record.role ?? "User");
      const role: UserRoleRecord["role"] = rawRole === "Admin" || rawRole === "Super Admin" ? rawRole : "User";
      return {
        id: String(record.id ?? `U-IMPORTED-${Date.now()}-${index}`),
        name: String(record.display_name ?? record.full_name ?? record.name ?? `Imported User ${index + 1}`),
        email: record.email_address ? String(record.email_address) : record.email ? String(record.email) : null,
        role,
        accountEnabled: typeof record.account_enabled === "boolean" ? record.account_enabled : true
      };
    });

    mappedUsers.forEach((incoming) => {
      const byIdIndex = users.findIndex((user) => user.id === incoming.id);
      if (byIdIndex >= 0) {
        users[byIdIndex] = { ...users[byIdIndex], ...incoming };
        return;
      }

      const incomingEmail = incoming.email?.trim().toLowerCase();
      if (incomingEmail) {
        const byEmailIndex = users.findIndex((user) => (user.email ?? "").trim().toLowerCase() === incomingEmail);
        if (byEmailIndex >= 0) {
          users[byEmailIndex] = { ...users[byEmailIndex], ...incoming, id: users[byEmailIndex].id };
          return;
        }
      }

      users.push(incoming);
    });

    let reset:
      | {
          pairsDeleted: number;
          attendanceDeleted: number;
          itemsUnassigned: number;
        }
      | undefined;

    if (input?.resetSessionAssignments && input.sessionId) {
      ensureSessionCollections(input.sessionId);
      const pairsDeleted = pairsBySession[input.sessionId].length;
      const attendanceDeleted = attendanceBySession[input.sessionId].length;
      let itemsUnassigned = 0;

      pairsBySession[input.sessionId] = [];
      attendanceBySession[input.sessionId] = [];
      itemsBySession[input.sessionId].forEach((item) => {
        if (item.assignedPair || item.assignedTo) {
          itemsUnassigned += 1;
        }
        item.assignedPair = "";
        item.assignedTo = null;
      });

      reset = { pairsDeleted, attendanceDeleted, itemsUnassigned };
    }

    return {
      imported: mappedUsers.length,
      received: sourceRows.length,
      reset
    };
  },

  async scanAttendance(input: { token: string; userId: string; name: string }): Promise<AttendanceScanResult> {
    await delay();
    const parts = input.token.trim().split(":");
    if (parts.length !== 3 || parts[0] !== "att") {
      throw new Error("Invalid attendance QR token");
    }
    const sessionId = parts[1] ?? "";
    const minute = Number(parts[2]);
    const nowMinute = Math.floor(Date.now() / 60_000);
    if (!sessionId || !Number.isFinite(minute) || Math.abs(nowMinute - Math.floor(minute)) > 1) {
      throw new Error("Attendance QR token has expired");
    }
    ensureSessionCollections(sessionId);

    const existing = attendanceBySession[sessionId].find((row) => row.userId === input.userId);
    const nowIso = new Date().toISOString();
    let slot: AttendanceScanResult["slot"] = "check_in";
    let checkIn = nowIso;
    let lunchOut: string | undefined;
    let lunchIn: string | undefined;
    let checkOut: string | undefined;

    if (existing) {
      existing.attended = true;
      existing.name = input.name;
      if (!existing.checkIn) {
        existing.checkIn = nowIso;
        slot = "check_in";
      } else if (!existing.lunchOut) {
        existing.lunchOut = nowIso;
        slot = "lunch_out";
      } else if (!existing.lunchIn) {
        existing.lunchIn = nowIso;
        slot = "lunch_in";
      } else {
        existing.checkOut = nowIso;
        slot = "check_out";
      }

      checkIn = existing.checkIn;
      lunchOut = existing.lunchOut;
      lunchIn = existing.lunchIn;
      checkOut = existing.checkOut;
    } else {
      attendanceBySession[sessionId].push({
        userId: input.userId,
        name: input.name,
        attended: true,
        checkIn: nowIso
      });
      checkIn = nowIso;
      slot = "check_in";
    }

    const slotMessages: Record<NonNullable<AttendanceScanResult["slot"]>, string> = {
      check_in: "Check-in recorded!",
      lunch_out: "Lunch out recorded!",
      lunch_in: "Back from lunch recorded!",
      check_out: "End-of-day check out recorded!"
    };

    return {
      sessionId,
      userId: input.userId,
      attended: true,
      checkIn,
      lunchOut,
      lunchIn,
      checkOut,
      slot,
      message: slotMessages[slot] ?? `Attendance marked for ${input.name}`
    };
  },

  async listCountHistory(submittedBy?: string, sessionId?: string): Promise<CountHistoryEntry[]> {
    await delay();
    const sessionMap = new Map(sessions.map((session) => [session.id, session.name]));
    const rows = Object.entries(auditBySession).flatMap(([sessionId, entries]) =>
      entries.map((entry) => ({
        id: entry.id,
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
  },

  async listUsers(): Promise<UserRoleRecord[]> {
    await delay();
    return clone(users);
  },

  async updateUserRole(userId: string, role: UserRoleRecord["role"]): Promise<UserRoleRecord | null> {
    await delay();
    const row = users.find((user) => user.id === userId);
    if (!row) return null;
    row.role = role;
    return clone(row);
  }
};

export function resetMockStore(): void {
  sessions.splice(0, sessions.length, ...clone(seedSnapshot.sessions));
  resetRecord(pairsBySession, seedSnapshot.pairsBySession);
  resetRecord(attendanceBySession, seedSnapshot.attendanceBySession);
  resetRecord(itemsBySession, seedSnapshot.itemsBySession);
  resetRecord(auditBySession, seedSnapshot.auditBySession);
  resetRecord(newItemsBySession, seedSnapshot.newItemsBySession);
  resetRecord(approvalsBySession, seedSnapshot.approvalsBySession);
  users.splice(0, users.length, ...clone(seedSnapshot.users));
}
