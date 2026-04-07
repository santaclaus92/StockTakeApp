export type SessionStatus = "Draft" | "Active" | "Closed";
export type SessionType = "Year End" | "Cycle Count";

export interface Session {
  id: string;
  name: string;
  type: SessionType;
  country: "Malaysia" | "Singapore";
  entity: "BMS" | "BMSD" | "BMSG";
  startDate: string;
  endDate: string;
  status: SessionStatus;
  progress: number;
  isRecount: boolean;
  parentId: string | null;
  userVisible: boolean;
  strictRoles: boolean;
  createdBy?: string | null;
}

export interface NewSessionInput {
  name: string;
  type: SessionType;
  country: Session["country"];
  entity: Session["entity"];
  startDate: string;
  endDate: string;
  isRecount?: boolean;
  parentId?: string | null;
  userVisible?: boolean;
}

export interface PairAssignment {
  id: string;
  counter: string;
  checker: string;
  counter2?: string;
  warehouse: string;
  role: "Admin" | "User";
}

export interface AttendanceRecord {
  userId: string;
  name: string;
  attended: boolean;
  checkIn?: string;
  lunchOut?: string;
  lunchIn?: string;
  checkOut?: string;
}

export interface ItemMasterItem {
  id: string;
  sessionId?: string;
  code: string;
  name: string;
  group?: string;
  batch?: string | null;
  uom?: string;
  packagingSize?: string | null;
  expiryDate?: string | null;
  category?: string | null;
  warehouse: string;
  whCode?: string | null;
  sapQty: number;
  countQty: number | null;
  stagedCountQty?: number | null;
  damagedQty?: number | null;
  expiredQty?: number | null;
  dropped: boolean;
  status: "Matched" | "Variance" | "Pending";
  countStatus?: string | null;
  newItem?: "Yes" | "No" | null;
  source?: string | null;
  assignedPair: string;
  assignedTo?: string | null;
  submittedBy?: string | null;
  remark?: string | null;
  adminRemark?: string;
  photos?: string[];
  checkerStatus?: "Pending" | "Approved" | "Rejected" | null;
}

export interface AuditEntry {
  id: string;
  itemCode: string;
  itemName: string;
  submittedBy: string;
  qty: number;
  countedAt: string;
  damagedQty?: number | null;
  expiredQty?: number | null;
  warehouse?: string;
  remark?: string;
}

export interface NewItemRecord {
  id: string;
  sessionId?: string;
  code: string;
  name: string;
  uom?: string | null;
  batch?: string | null;
  status: "Pending" | "Approved" | "Rejected";
  submittedBy: string;
  warehouse?: string | null;
  qty?: number | null;
  damagedQty?: number | null;
  expiredQty?: number | null;
  remark?: string | null;
  photos?: string[];
  createdAt?: string;
  checkerStatus?: "Pending" | "Approved" | "Rejected" | null;
}

export interface NewItemCreateInput {
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
}

export interface ApprovalRecord {
  id: string;
  itemCode: string;
  itemName: string;
  oldQty: number;
  newQty: number;
  status: "Pending" | "Approved" | "Rejected";
  submittedBy: string;
  oldBin?: string | null;
  newBin?: string | null;
  createdAt?: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}

export interface DashboardSummary {
  totalItems: number;
  countedItems: number;
  pendingItems: number;
  newItems: number;
}

export interface DashboardBreakdownRow {
  key: string;
  total: number;
  counted: number;
  pending: number;
  matched: number;
  variance: number;
  notFound: number;
  newItems: number;
}

export interface DashboardDetails {
  byGroup: DashboardBreakdownRow[];
  byWarehouse: DashboardBreakdownRow[];
}

export interface WarehouseItem {
  id: string;
  sessionId?: string;
  code: string;
  name: string;
  warehouse: string;
  whCode?: string | null;
  assignedTo: string;
  sapQty: number;
  countQty: number | null;
  photos?: string[];
  uom?: string;
  packagingSize?: string;
  batch?: string | null;
}

export interface CountSubmissionInput {
  itemId: string;
  qty: number;
  submittedBy: string;
  damagedQty?: number | null;
  expiredQty?: number | null;
  remark?: string;
  photos?: string[];
  binLocation?: string;
}

export interface ItemUpdateInput {
  sessionId: string;
  itemId: string;
  countQty?: number | null;
  damagedQty?: number | null;
  expiredQty?: number | null;
  dropped?: boolean;
  assignedPair?: string | null;
  assignedTo?: string | null;
  adminRemark?: string | null;
}

export interface BulkAssignInput {
  sessionId: string;
  itemIds: string[];
  pairId: string | null;
  assignedTo?: string | null;
}

export interface CountHistoryEntry {
  id: string;
  itemId?: string;
  sessionId: string;
  sessionName: string;
  itemCode: string;
  itemName: string;
  qty: number;
  countedAt: string;
  submittedBy: string;
  warehouse?: string;
  remark?: string;
}

export interface UserRoleRecord {
  id: string;
  name: string;
  email: string | null;
  role: "User" | "Admin" | "Super Admin";
  country?: Session["country"] | null;
  accountEnabled?: boolean;
}

export interface AttendanceScanResult {
  sessionId: string;
  userId: string;
  attended: boolean;
  checkIn: string;
  lunchOut?: string;
  lunchIn?: string;
  checkOut?: string;
  slot?: "check_in" | "lunch_out" | "lunch_in" | "check_out";
  affectedSessionIds?: string[];
  message: string;
}

export interface SessionAssignmentResetResult {
  pairsDeleted: number;
  attendanceDeleted: number;
  itemsUnassigned: number;
}

export interface ImportRowsResult {
  imported: number;
  received: number;
  pagesFetched?: number;
}

export interface ImportUsersResult extends ImportRowsResult {
  reset?: SessionAssignmentResetResult;
}
