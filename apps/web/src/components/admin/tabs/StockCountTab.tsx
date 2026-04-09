import { useEffect, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { BannerModal } from "../../ui/BannerModal";
import {
  useBulkAssignItemsMutation,
  useImportItemsFromSapMutation,
  useItemsQuery,
  usePairsQuery,
  useUpdateItemMutation
} from "../../../hooks/useAdminData";
import type { ItemMasterItem, PairAssignment } from "../../../types/domain";
import {
  buildItemMasterLayoutStorageKey,
  calculateDefaultColumnWidth,
  COLUMN_WIDTH_MAX,
  COLUMN_WIDTH_MIN
} from "./stockCountLayout";

interface StockCountTabProps {
  sessionId: string;
  entity?: string;
  isRecount?: boolean;
  parentSessionId?: string | null;
}

type StatusFilter = "all" | "active" | "dropped" | "matched" | "variance" | "new_item" | "not_found";
type CountStatusLabel = "Matched" | "Variance" | "New item" | "Not found" | "Pending";
type TableColumnKey =
  | "chk"
  | "status"
  | "code"
  | "name"
  | "grp"
  | "batch"
  | "uom"
  | "pkg"
  | "expiry"
  | "category"
  | "sap"
  | "cnt"
  | "dmg"
  | "exp"
  | "by"
  | "whcode"
  | "binloc"
  | "remark"
  | "adminremark"
  | "photos"
  | "pair"
  | "src"
  | "p1bin"
  | "p1by"
  | "p1cnt"
  | "action";

const PAGE_SIZE = 25;
const EMPTY_ITEMS: ItemMasterItem[] = [];
const EMPTY_PAIRS: PairAssignment[] = [];
const BASE_COLUMN_ORDER: TableColumnKey[] = [
  "chk",
  "status",
  "code",
  "name",
  "grp",
  "batch",
  "uom",
  "pkg",
  "expiry",
  "category",
  "sap",
  "cnt",
  "dmg",
  "exp",
  "by",
  "whcode",
  "binloc",
  "remark",
  "adminremark",
  "photos",
  "pair",
  "src",
  "p1bin",
  "p1by",
  "p1cnt",
  "action"
];
const NON_DRAGGABLE_COLUMNS: TableColumnKey[] = ["chk", "action"];

const defaultColumns = {
  batch: true,
  uom: true,
  packagingSize: true,
  expiryDate: true,
  category: true,
  damagedQty: true,
  expiredQty: true,
  countedBy: true,
  whCode: true,
  binLocation: true,
  remark: true,
  adminRemark: true,
  photos: true
};

const HEADER_LABELS: Record<TableColumnKey, string> = {
  chk: "",
  status: "Status",
  code: "Item code",
  name: "Item name",
  grp: "Group",
  batch: "Batch",
  uom: "UoM",
  pkg: "Packaging Size",
  expiry: "Expiry",
  category: "Category",
  sap: "SAP Qty",
  cnt: "Counted Qty",
  dmg: "Damaged Qty",
  exp: "Expired Qty",
  by: "Counted By",
  whcode: "Warehouse Code",
  binloc: "Bin Location",
  remark: "Remark",
  adminremark: "Admin Remark",
  photos: "Photos",
  pair: "Assigned To",
  src: "Count Status",
  p1bin: "1st Bin",
  p1by: "1st Counted By",
  p1cnt: "1st Count Qty",
  action: "Action"
};

const DEFAULT_COLUMN_WIDTHS: Partial<Record<TableColumnKey, number>> = BASE_COLUMN_ORDER.reduce((acc, key) => {
  if (key === "chk") {
    acc[key] = 24;
    return acc;
  }
  acc[key] = calculateDefaultColumnWidth(HEADER_LABELS[key]);
  return acc;
}, {} as Partial<Record<TableColumnKey, number>>);

type StoredItemMasterLayout = {
  columnOrder?: unknown;
  columnWidths?: unknown;
};

function getStoredIdentityScope(): string {
  if (typeof window === "undefined") return "anon";
  try {
    const raw = localStorage.getItem("sta_identity");
    if (!raw) return "anon";
    const parsed = JSON.parse(raw) as { id?: string; email?: string };
    if (typeof parsed.id === "string" && parsed.id.trim()) return parsed.id.trim();
    if (typeof parsed.email === "string" && parsed.email.trim()) return parsed.email.trim().toLowerCase();
    return "anon";
  } catch {
    return "anon";
  }
}

function normalizeStoredColumnOrder(input: unknown): TableColumnKey[] | null {
  if (!Array.isArray(input)) return null;
  const seen = new Set<TableColumnKey>();
  const normalized = input
    .filter((value): value is TableColumnKey => typeof value === "string" && BASE_COLUMN_ORDER.includes(value as TableColumnKey))
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });

  if (normalized.length === 0) return null;
  BASE_COLUMN_ORDER.forEach((key) => {
    if (!seen.has(key)) normalized.push(key);
  });
  return normalized;
}

function normalizeStoredColumnWidths(input: unknown): Partial<Record<TableColumnKey, number>> | null {
  if (!input || typeof input !== "object") return null;
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length === 0) return null;

  const normalized: Partial<Record<TableColumnKey, number>> = {};
  entries.forEach(([rawKey, rawValue]) => {
    if (!BASE_COLUMN_ORDER.includes(rawKey as TableColumnKey)) return;
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) return;
    const key = rawKey as TableColumnKey;
    if (key === "chk") {
      normalized[key] = 24;
      return;
    }
    normalized[key] = Math.max(COLUMN_WIDTH_MIN, Math.min(COLUMN_WIDTH_MAX, Math.round(numeric)));
  });

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function resolveCountStatus(item: ItemMasterItem): CountStatusLabel {
  const raw = (item.countStatus ?? "").trim().toLowerCase();
  if (raw === "new item") return "New item";
  if (raw === "not found") return "Not found";
  if (item.newItem === "Yes" || item.sapQty === 0) return "New item";
  // When count hasn't been submitted yet, use stored status as the starting point
  // (recount sessions carry over Variance from the parent session)
  if (item.countQty === null || item.countQty === undefined) {
    if (item.status === "Variance") return "Variance";
    return "Not found";
  }
  if (item.status === "Matched") return "Matched";
  if (item.status === "Variance") return "Variance";
  return "Pending";
}

function statusFilterPass(item: ItemMasterItem, statusFilter: StatusFilter): boolean {
  const countStatus = resolveCountStatus(item);

  if (statusFilter === "all") return true;
  if (statusFilter === "active") return !item.dropped;
  if (statusFilter === "dropped") return item.dropped;
  if (statusFilter === "matched") return countStatus === "Matched";
  if (statusFilter === "variance") return countStatus === "Variance";
  if (statusFilter === "new_item") return countStatus === "New item";
  if (statusFilter === "not_found") return countStatus === "Not found";

  return true;
}

function countStatusBadgeClass(status: CountStatusLabel): string {
  if (status === "Matched") return "badge b-success";
  if (status === "Variance") return "badge b-warn";
  if (status === "New item") return "badge b-purple";
  if (status === "Not found") return "badge b-danger";
  return "badge b-gray";
}

function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, "\"\"")}"`;
  }
  return raw;
}

export function StockCountTab({ sessionId, entity, isRecount = false, parentSessionId = null }: StockCountTabProps) {
  const { data: itemsData, isLoading, refetch: refetchItems } = useItemsQuery(sessionId);
  const { data: parentItemsData = EMPTY_ITEMS } = useItemsQuery(parentSessionId ?? "", Boolean(isRecount && parentSessionId));
  const { data: pairsData } = usePairsQuery(sessionId);
  const items = itemsData ?? EMPTY_ITEMS;
  const pairs = pairsData ?? EMPTY_PAIRS;
  const updateItem = useUpdateItemMutation(sessionId);
  const bulkAssign = useBulkAssignItemsMutation(sessionId);
  const importItems = useImportItemsFromSapMutation(sessionId);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [compact, setCompact] = useState(false);
  const [columns, setColumns] = useState(defaultColumns);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [page, setPage] = useState(1);
  const [bulkPairId, setBulkPairId] = useState("");
  const [photoItem, setPhotoItem] = useState<ItemMasterItem | null>(null);
  const [remarkPopupText, setRemarkPopupText] = useState<string | null>(null);
  const [remarkDraft, setRemarkDraft] = useState<Record<string, string>>({});
  const [showImportModal, setShowImportModal] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "warning"; text: string } | null>(null);
  const [bulkLoadingAction, setBulkLoadingAction] = useState<"drop" | "recover" | null>(null);
  const [columnOrder, setColumnOrder] = useState<TableColumnKey[]>(BASE_COLUMN_ORDER);
  const [dragColumn, setDragColumn] = useState<TableColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TableColumnKey | null>(null);
  const [lastCheckedIndex, setLastCheckedIndex] = useState<number | null>(null);
  const [columnWidths, setColumnWidths] = useState<Partial<Record<TableColumnKey, number>>>(DEFAULT_COLUMN_WIDTHS);
  const [sortColumn, setSortColumn] = useState<TableColumnKey | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const layoutStorageKey = useMemo(() => buildItemMasterLayoutStorageKey(getStoredIdentityScope(), sessionId), [sessionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let nextOrder = BASE_COLUMN_ORDER;
    let nextWidths = DEFAULT_COLUMN_WIDTHS;

    try {
      const raw = sessionStorage.getItem(layoutStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredItemMasterLayout;
        const parsedOrder = normalizeStoredColumnOrder(parsed.columnOrder);
        const parsedWidths = normalizeStoredColumnWidths(parsed.columnWidths);
        if (parsedOrder) nextOrder = parsedOrder;
        if (parsedWidths) nextWidths = { ...DEFAULT_COLUMN_WIDTHS, ...parsedWidths };
      }
    } catch {
      nextOrder = BASE_COLUMN_ORDER;
      nextWidths = DEFAULT_COLUMN_WIDTHS;
    }

    setColumnOrder(nextOrder);
    setColumnWidths(nextWidths);
  }, [layoutStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = JSON.stringify({
      columnOrder,
      columnWidths
    });
    sessionStorage.setItem(layoutStorageKey, payload);
  }, [columnOrder, columnWidths, layoutStorageKey]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, groupFilter, warehouseFilter]);

  useEffect(() => {
    setSelectedIds((previous) => {
      if (previous.size === 0) return previous;
      const validItemIds = new Set(items.map((item) => item.id));
      const next = new Set<string>();
      let changed = false;
      previous.forEach((id) => {
        if (validItemIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      if (!changed && next.size === previous.size) return previous;
      return next;
    });
  }, [items]);

  const warehouseOptions = useMemo(
    () =>
      Array.from(
        new Set(items.map((item) => (item.whCode ?? "").trim()).filter((value): value is string => value.length > 0))
      ).sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const groupOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.group).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const firstCountByCode = useMemo(() => {
    const next = new Map<
      string,
      {
        bin: string | null;
        by: string | null;
        qty: number | null;
      }
    >();
    parentItemsData.forEach((item) => {
      if (!item.code) return;
      const key = `${item.code}::${item.batch ?? ""}`;
      next.set(key, {
        bin: item.warehouse ?? null,
        by: item.submittedBy ?? item.assignedTo ?? null,
        qty: item.countQty ?? null
      });
    });
    return next;
  }, [parentItemsData]);

  const statusCards = useMemo(() => {
    const countBy = (predicate: (item: ItemMasterItem) => boolean) => items.filter(predicate).length;
    return {
      all: items.length,
      matched: countBy((item) => resolveCountStatus(item) === "Matched"),
      variance: countBy((item) => resolveCountStatus(item) === "Variance"),
      newItem: countBy((item) => resolveCountStatus(item) === "New item"),
      notFound: countBy((item) => resolveCountStatus(item) === "Not found")
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const searchPass =
        !query ||
        item.code.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query) ||
        (item.batch ?? "").toLowerCase().includes(query) ||
        (item.whCode ?? "").toLowerCase().includes(query) ||
        (item.warehouse ?? "").toLowerCase().includes(query);
      const statusPass = statusFilterPass(item, statusFilter);
      const warehousePass = !warehouseFilter || (item.whCode ?? "") === warehouseFilter;
      const groupPass = !groupFilter || item.group === groupFilter;
      return searchPass && statusPass && warehousePass && groupPass;
    });
  }, [groupFilter, items, search, statusFilter, warehouseFilter]);

  const sortedItems = useMemo(() => {
    if (!sortColumn || sortColumn === "chk" || sortColumn === "action") return filteredItems;
    const dir = sortDirection === "asc" ? 1 : -1;
    return [...filteredItems].sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      if (sortColumn === "code") { aVal = a.code; bVal = b.code; }
      else if (sortColumn === "name") { aVal = a.name; bVal = b.name; }
      else if (sortColumn === "grp") { aVal = a.group ?? ""; bVal = b.group ?? ""; }
      else if (sortColumn === "batch") { aVal = a.batch ?? ""; bVal = b.batch ?? ""; }
      else if (sortColumn === "uom") { aVal = a.uom ?? ""; bVal = b.uom ?? ""; }
      else if (sortColumn === "sap") { aVal = a.sapQty; bVal = b.sapQty; }
      else if (sortColumn === "cnt") { aVal = a.countQty ?? -1; bVal = b.countQty ?? -1; }
      else if (sortColumn === "dmg") { aVal = a.damagedQty ?? -1; bVal = b.damagedQty ?? -1; }
      else if (sortColumn === "exp") { aVal = a.expiredQty ?? -1; bVal = b.expiredQty ?? -1; }
      else if (sortColumn === "by") { aVal = a.submittedBy ?? ""; bVal = b.submittedBy ?? ""; }
      else if (sortColumn === "whcode") { aVal = a.whCode ?? ""; bVal = b.whCode ?? ""; }
      else if (sortColumn === "binloc") { aVal = a.warehouse ?? ""; bVal = b.warehouse ?? ""; }
      else if (sortColumn === "pair") { aVal = a.assignedPair ?? ""; bVal = b.assignedPair ?? ""; }
      else if (sortColumn === "status") { aVal = resolveCountStatus(a); bVal = resolveCountStatus(b); }
      if (typeof aVal === "number" && typeof bVal === "number") return (aVal - bVal) * dir;
      return String(aVal).localeCompare(String(bVal)) * dir;
    });
  }, [filteredItems, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedItems = sortedItems.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id));
  const selectedCount = selectedIds.size;
  const droppedCount = items.filter((item) => item.dropped).length;
  const itemsSubText = `Showing ${filteredItems.length} items${totalPages > 1 ? ` - page ${safePage}/${totalPages}` : ""}`;
  const pagerInfo =
    filteredItems.length === 0
      ? "0 of 0 items"
      : `${pageStart + 1}-${Math.min(pageStart + PAGE_SIZE, filteredItems.length)} of ${filteredItems.length} items`;

  const handleSelectAllFiltered = () => {
    setSelectedIds((previous) => {
      if (allFilteredSelected) {
        return new Set();
      }
      const next = new Set(previous);
      filteredItems.forEach((item) => next.add(item.id));
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      filteredItems.forEach((item) => next.add(item.id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkToggleDrop = async (dropped: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkLoadingAction(dropped ? "drop" : "recover");
    try {
      await Promise.all(ids.map((itemId) => updateItem.mutateAsync({ itemId, dropped })));
      setFeedback({
        type: "success",
        text: `${ids.length} item(s) ${dropped ? "dropped" : "recovered"}.`
      });
      setSelectedIds(new Set());
    } catch (error) {
      setFeedback({
        type: "warning",
        text: (error as Error).message || "Bulk update failed."
      });
    } finally {
      setBulkLoadingAction(null);
    }
  };

  const activateAllDropped = async () => {
    const droppedIds = items.filter((item) => item.dropped).map((item) => item.id);
    if (droppedIds.length === 0) return;
    const ok = window.confirm(`Activate all ${droppedIds.length} dropped item(s)?`);
    if (!ok) return;

    try {
      await Promise.all(droppedIds.map((itemId) => updateItem.mutateAsync({ itemId, dropped: false })));
      setFeedback({
        type: "success",
        text: `${droppedIds.length} item(s) activated.`
      });
    } catch (error) {
      setFeedback({
        type: "warning",
        text: (error as Error).message || "Activate all dropped failed."
      });
    }
  };

  const handleBulkAssign = async () => {
    if (!isRecount) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const targetPair = pairs.find((pair) => pair.id === bulkPairId);
    try {
      await bulkAssign.mutateAsync({
        itemIds: ids,
        pairId: bulkPairId || null,
        assignedTo: targetPair
          ? [targetPair.counter, targetPair.checker, targetPair.counter2].filter((value): value is string => Boolean(value)).join(" / ")
          : null
      });
      setFeedback({
        type: "success",
        text: `${ids.length} item(s) assigned.`
      });
      setSelectedIds(new Set());
    } catch (error) {
      setFeedback({
        type: "warning",
        text: (error as Error).message || "Bulk assign failed."
      });
    }
  };

  const saveAdminRemark = async (item: ItemMasterItem) => {
    const draft = (remarkDraft[item.id] ?? item.adminRemark ?? "").trim();
    const current = (item.adminRemark ?? "").trim();
    if (draft === current) return;
    try {
      await updateItem.mutateAsync({
        itemId: item.id,
        adminRemark: draft || null
      });
      setFeedback({
        type: "success",
        text: `Admin remark saved for ${item.code}.`
      });
    } catch (error) {
      setFeedback({
        type: "warning",
        text: (error as Error).message || "Failed to save admin remark."
      });
    }
  };


  const exportCsv = () => {
    const headers = [
      "Item Code",
      "Item Name",
      "Group",
      "Warehouse Code",
      "Bin Location",
      "SAP Qty",
      "Count Qty",
      "Damaged Qty",
      "Expired Qty",
      "Status",
      "Count Status",
      "Dropped",
      "Assigned To",
      "Remark",
      "Admin Remark"
    ];

    const lines = filteredItems.map((item) =>
      [
        item.code,
        item.name,
        item.group ?? "",
        item.whCode ?? "",
        item.warehouse ?? "",
        item.sapQty,
        item.countQty ?? "",
        item.damagedQty ?? "",
        item.expiredQty ?? "",
        item.status,
        resolveCountStatus(item),
        item.dropped ? "Yes" : "No",
        item.assignedTo ?? item.assignedPair ?? "",
        item.remark ?? "",
        item.adminRemark ?? ""
      ]
        .map((value) => escapeCsvValue(value))
        .join(",")
    );

    const csv = [headers.join(","), ...lines].join("\n");
    const filename = `item-master-${sessionId}.csv`;

    if (import.meta.env.MODE !== "test") {
      const anchor = document.createElement("a");
      anchor.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }

    setFeedback({
      type: "success",
      text: `Exported ${filteredItems.length} item(s).`
    });
  };

  const columnVisibility = useMemo<Record<TableColumnKey, boolean>>(
    () => ({
      chk: true,
      status: true,
      code: true,
      name: true,
      grp: true,
      batch: columns.batch,
      uom: columns.uom,
      pkg: columns.packagingSize,
      expiry: columns.expiryDate,
      category: columns.category,
      sap: true,
      cnt: true,
      dmg: columns.damagedQty,
      exp: columns.expiredQty,
      by: columns.countedBy,
      whcode: columns.whCode,
      binloc: columns.binLocation,
      remark: columns.remark,
      adminremark: columns.adminRemark,
      photos: columns.photos,
      pair: isRecount,
      src: true,
      p1bin: isRecount,
      p1by: isRecount,
      p1cnt: isRecount,
      action: true
    }),
    [columns, isRecount]
  );

  const orderedColumns = useMemo(() => {
    const seen = new Set<TableColumnKey>();
    const normalized = columnOrder.filter((key) => {
      if (!BASE_COLUMN_ORDER.includes(key)) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    BASE_COLUMN_ORDER.forEach((key) => {
      if (!seen.has(key)) normalized.push(key);
    });

    return normalized;
  }, [columnOrder]);

  const headerLabel = (key: TableColumnKey): string => HEADER_LABELS[key] ?? "";

  const isColumnDraggable = (key: TableColumnKey) => !NON_DRAGGABLE_COLUMNS.includes(key);

  const handleHeaderDrop = (target: TableColumnKey) => {
    if (!dragColumn || !isColumnDraggable(dragColumn) || !isColumnDraggable(target)) {
      setDragOverColumn(null);
      return;
    }
    if (dragColumn === target) {
      setDragOverColumn(null);
      return;
    }

    setColumnOrder((previous) => {
      const from = previous.indexOf(dragColumn);
      const to = previous.indexOf(target);
      if (from < 0 || to < 0) return previous;
      const next = [...previous];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });

    setDragOverColumn(null);
  };

  const startResize = (event: ReactMouseEvent<HTMLSpanElement>, key: TableColumnKey) => {
    event.preventDefault();
    event.stopPropagation();

    const th = event.currentTarget.parentElement as HTMLElement | null;
    const startWidth = columnWidths[key] ?? th?.getBoundingClientRect().width ?? 120;
    const startX = event.clientX;

    const onMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextWidth = Math.max(COLUMN_WIDTH_MIN, Math.min(COLUMN_WIDTH_MAX, Math.round(startWidth + delta)));
      setColumnWidths((previous) => ({
        ...previous,
        [key]: nextWidth
      }));
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const columnStyle = (key: TableColumnKey) => {
    const width = columnWidths[key];
    return {
      ...(columnVisibility[key] ? {} : { display: "none" }),
      ...(width ? { width, minWidth: width } : {})
    };
  };

  const updateItemPair = async (item: ItemMasterItem, nextPairId: string) => {
    const pair = pairs.find((entry) => entry.id === nextPairId);
    const assignedTo = pair ? [pair.counter, pair.checker, pair.counter2].filter(Boolean).join(" / ") : null;
    try {
      await updateItem.mutateAsync({
        itemId: item.id,
        assignedPair: nextPairId || null,
        assignedTo
      });
    } catch (error) {
      setFeedback({
        type: "warning",
        text: (error as Error).message || "Failed to update pair assignment."
      });
    }
  };

  return (
    <section className="panel item-master-panel">
      <div className="tab-header-row">
        <div>
          <h3>Item Master</h3>
          <p>{itemsSubText}</p>
        </div>
        <div className="tab-actions">
          <button type="button" className="btn btn-sm" disabled={isLoading} onClick={() => void refetchItems()}>
            {isLoading ? "Refreshing…" : "Refresh"}
          </button>
          {!isRecount && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowImportModal(true)}>
              Import from SAP
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
      </div>

      {feedback ? (
        <BannerModal
          type={feedback.type}
          message={feedback.text}
          onClose={() => setFeedback(null)}
        />
      ) : null}

      <div className="status-strip">
        <button type="button" className={statusFilter === "all" ? "active" : ""} onClick={() => setStatusFilter("all")}>
          All Status ({statusCards.all})
        </button>
        <button
          type="button"
          className={statusFilter === "matched" ? "active matched" : "matched"}
          onClick={() => setStatusFilter("matched")}
        >
          Matched ({statusCards.matched})
        </button>
        <button
          type="button"
          className={statusFilter === "variance" ? "active variance" : "variance"}
          onClick={() => setStatusFilter("variance")}
        >
          Variance ({statusCards.variance})
        </button>
        <button
          type="button"
          className={statusFilter === "new_item" ? "active pending" : "pending"}
          onClick={() => setStatusFilter("new_item")}
        >
          New Item ({statusCards.newItem})
        </button>
        <button
          type="button"
          className={statusFilter === "not_found" ? "active pending" : "pending"}
          onClick={() => setStatusFilter("not_found")}
        >
          Not Found ({statusCards.notFound})
        </button>
      </div>

      <div className="legacy-form-card item-master-card">
        <div className="item-master-toolbar">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search code or name..."
            aria-label="Search items"
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            <option value="all">All items</option>
            <option value="active">Active</option>
            <option value="dropped">Dropped</option>
            <option value="matched">Matched</option>
            <option value="variance">Variance</option>
            <option value="new_item">New Item</option>
            <option value="not_found">Not Found</option>
          </select>
          <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
            <option value="">All groups</option>
            {groupOptions.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
          <select value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)}>
            <option value="">All warehouses</option>
            {warehouseOptions.map((warehouse) => (
              <option key={warehouse} value={warehouse}>
                {warehouse}
              </option>
            ))}
          </select>
          <button type="button" onClick={selectAllFiltered}>
            Select all {filteredItems.length}
          </button>
          {droppedCount > 0 ? (
            <button type="button" onClick={() => void activateAllDropped()}>
              Activate all dropped ({droppedCount})
            </button>
          ) : null}
          <button type="button" onClick={() => setCompact((value) => !value)}>
            {compact ? "Comfortable" : "Compact"}
          </button>
          <div className="col-toggle-wrap">
            <button type="button" className="col-toggle-btn" onClick={() => setShowColumnMenu((value) => !value)}>
              Columns
            </button>
            {showColumnMenu ? (
              <div className="col-toggle-menu">
                {[
                  ["batch", "Batch"],
                  ["uom", "UoM"],
                  ["packagingSize", "Packaging Size"],
                  ["expiryDate", "Expiry"],
                  ["category", "Category"],
                  ["damagedQty", "Damaged Qty"],
                  ["expiredQty", "Expired Qty"],
                  ["countedBy", "Counted By"],
                  ["whCode", "Warehouse Code"],
                  ["binLocation", "Bin Location"],
                  ["remark", "Remark"],
                  ["adminRemark", "Admin Remark"],
                  ["photos", "Photos"]
                ].map(([key, label]) => (
                  <label key={key} className="col-toggle-item">
                    <input
                      type="checkbox"
                      checked={columns[key as keyof typeof columns]}
                      onChange={() =>
                        setColumns((previous) => ({
                          ...previous,
                          [key]: !previous[key as keyof typeof previous]
                        }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {selectedCount > 0 ? (
          <div className="item-master-bulk-bar">
            <span className="item-master-selected-label">{selectedCount} selected</span>
            <button type="button" className="btn btn-sm drop-btn" onClick={() => void bulkToggleDrop(true)} disabled={bulkLoadingAction !== null}>
              Drop selected
            </button>
            <button type="button" className="btn btn-sm rec-btn" onClick={() => void bulkToggleDrop(false)} disabled={bulkLoadingAction !== null}>
              Recover selected
            </button>
            {isRecount ? (
              <div className="item-master-bulk-assign-wrap">
                <select
                  className="select"
                  value={bulkPairId}
                  onChange={(event) => setBulkPairId(event.target.value)}
                  style={{ width: "auto", fontSize: 11 }}
                >
                  <option value="">- Assign pair -</option>
                  {pairs.map((pair) => (
                    <option key={pair.id} value={pair.id}>
                      {pair.counter} / {pair.checker}{pair.counter2 ? ` / ${pair.counter2}` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={!bulkPairId || bulkAssign.isPending}
                  onClick={() => void handleBulkAssign()}
                >
                  {bulkAssign.isPending ? "Assigning..." : "Assign"}
                </button>
              </div>
            ) : null}
            <button type="button" className="btn btn-sm" onClick={clearSelection}>
              Clear
            </button>
          </div>
        ) : null}

        <div className="item-master-table-wrap">
          {isLoading ? <p className="item-master-loading">Loading item master...</p> : null}
          <table className={`legacy-table item-master-table ${compact ? "compact" : ""}`}>
            <thead>
              <tr>
                {orderedColumns.map((columnKey) => {
                  if (columnKey === "chk") {
                    return (
                      <th key={columnKey} data-colkey={columnKey} style={{ width: 24 }}>
                        <input
                          type="checkbox"
                          aria-label="Select all filtered items"
                          checked={allFilteredSelected}
                          onChange={handleSelectAllFiltered}
                        />
                      </th>
                    );
                  }

                  const isSortable = columnKey !== "chk" && columnKey !== "action" && columnKey !== "photos";
                  const isSorted = sortColumn === columnKey;
                  return (
                    <th
                      key={columnKey}
                      data-colkey={columnKey}
                      style={columnStyle(columnKey)}
                      draggable={isColumnDraggable(columnKey)}
                      className={`${dragColumn === columnKey ? "item-col-dragging" : ""} ${
                        dragOverColumn === columnKey ? "item-col-drag-over" : ""
                      } ${isSortable ? "item-col-sortable" : ""}`}
                      onDragStart={(event) => {
                        if (!isColumnDraggable(columnKey)) return;
                        setDragColumn(columnKey);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(event) => {
                        if (!isColumnDraggable(columnKey)) return;
                        event.preventDefault();
                        setDragOverColumn(columnKey);
                      }}
                      onDragLeave={() => {
                        if (dragOverColumn === columnKey) {
                          setDragOverColumn(null);
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleHeaderDrop(columnKey);
                      }}
                      onDragEnd={() => {
                        setDragColumn(null);
                        setDragOverColumn(null);
                      }}
                      onClick={() => {
                        if (!isSortable) return;
                        if (sortColumn === columnKey) {
                          setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                        } else {
                          setSortColumn(columnKey);
                          setSortDirection("asc");
                        }
                      }}
                    >
                      <span className="item-col-label">
                        {headerLabel(columnKey)}
                        {isSorted ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
                      </span>
                      {isColumnDraggable(columnKey) ? (
                        <span className="item-col-resizer" onMouseDown={(event) => startResize(event, columnKey)} />
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pagedItems.length === 0 ? (
                <tr>
                  <td colSpan={orderedColumns.length} className="item-master-empty-row">
                    No items
                  </td>
                </tr>
              ) : (
                pagedItems.map((item) => {
                  const countStatus = resolveCountStatus(item);
                  const remarkText = (item.remark ?? "").trim();
                  const adminRemarkValue = remarkDraft[item.id] ?? item.adminRemark ?? "";
                  const photoCount = item.photos?.length ?? 0;
                  const firstCount = firstCountByCode.get(`${item.code}::${item.batch ?? ""}`);
                  return (
                    <tr key={item.id} className={item.dropped ? "row-dropped" : ""}>
                      {orderedColumns.map((columnKey) => {
                        const style = columnStyle(columnKey);

                        if (columnKey === "chk") {
                          return (
                            <td key={columnKey} data-colkey={columnKey} style={style}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(item.id)}
                                onChange={(event) => {
                                  const checked = event.target.checked;
                                  const currentIndex = pagedItems.findIndex((it) => it.id === item.id);
                                  
                                  setSelectedIds((previous) => {
                                    const next = new Set(previous);
                                    const nativeEvent = event.nativeEvent as KeyboardEvent | MouseEvent | PointerEvent;
                                    
                                    if (nativeEvent.shiftKey && lastCheckedIndex !== null) {
                                      const start = Math.min(lastCheckedIndex, currentIndex);
                                      const end = Math.max(lastCheckedIndex, currentIndex);
                                      
                                      for (let i = start; i <= end; i++) {
                                        const id = pagedItems[i].id;
                                        if (checked) next.add(id);
                                        else next.delete(id);
                                      }
                                    } else {
                                      if (checked) next.add(item.id);
                                      else next.delete(item.id);
                                    }
                                    
                                    return next;
                                  });
                                  
                                  setLastCheckedIndex(currentIndex);
                                }}
                              />
                            </td>
                          );
                        }

                        if (columnKey === "status") {
                          return (
                            <td key={columnKey} data-colkey={columnKey} style={style}>
                              <span className={`badge ${item.dropped ? "is-drop" : "is-active"}`}>{item.dropped ? "Dropped" : "Active"}</span>
                            </td>
                          );
                        }

                        if (columnKey === "code") return <td key={columnKey} data-colkey={columnKey} style={style}>{item.code}</td>;
                        if (columnKey === "name") return <td key={columnKey} data-colkey={columnKey} style={style}>{item.name}</td>;
                        if (columnKey === "grp") return <td key={columnKey} data-colkey={columnKey} style={style}>{item.group || "-"}</td>;
                        if (columnKey === "batch") return <td key={columnKey} data-colkey={columnKey} style={style}>{item.batch || "-"}</td>;
                        if (columnKey === "uom") return <td key={columnKey} data-colkey={columnKey} style={style}>{item.uom || "-"}</td>;
                        if (columnKey === "pkg") return <td key={columnKey} data-colkey={columnKey} style={style}>{item.packagingSize || "-"}</td>;
                        if (columnKey === "expiry") return <td key={columnKey} data-colkey={columnKey} style={style}>{item.expiryDate || "-"}</td>;
                        if (columnKey === "category") return <td key={columnKey} data-colkey={columnKey} style={style}>{item.category || "-"}</td>;
                        if (columnKey === "sap") return <td key={columnKey} data-colkey={columnKey} style={style}>{item.sapQty}</td>;

                        if (columnKey === "cnt") {
                          return (
                            <td key={columnKey} data-colkey={columnKey} style={style}>
                              {item.countQty === null ? <span className="qty-null">-</span> : <span className="qty-counted">{item.countQty}</span>}
                            </td>
                          );
                        }

                        if (columnKey === "dmg") {
                          return (
                            <td key={columnKey} data-colkey={columnKey} style={style}>
                              {item.damagedQty === null || item.damagedQty === undefined ? (
                                <span className="qty-null">-</span>
                              ) : (
                                <span className="qty-dmg">{item.damagedQty}</span>
                              )}
                            </td>
                          );
                        }

                        if (columnKey === "exp") {
                          return (
                            <td key={columnKey} data-colkey={columnKey} style={style}>
                              {item.expiredQty === null || item.expiredQty === undefined ? (
                                <span className="qty-null">-</span>
                              ) : (
                                <span className="qty-exp">{item.expiredQty}</span>
                              )}
                            </td>
                          );
                        }

                        if (columnKey === "by") return <td key={columnKey} data-colkey={columnKey} style={style}>{item.countQty !== null && item.countQty !== undefined ? (item.submittedBy || "") : ""}</td>;
                        if (columnKey === "whcode") return <td key={columnKey} data-colkey={columnKey} style={style}>{item.whCode || "-"}</td>;
                        if (columnKey === "binloc") return <td key={columnKey} data-colkey={columnKey} style={style}>{item.countQty !== null && item.countQty !== undefined ? (item.warehouse || "") : ""}</td>;

                        if (columnKey === "remark") {
                          return (
                            <td key={columnKey} data-colkey={columnKey} style={style} className="item-master-remark-cell">
                              {!remarkText ? (
                                <span className="qty-null">-</span>
                              ) : remarkText.length <= 20 ? (
                                <span>{remarkText}</span>
                              ) : (
                                <button
                                  type="button"
                                  className="remark-link-btn"
                                  title={remarkText}
                                  onClick={() => setRemarkPopupText(remarkText)}
                                >
                                  {remarkText.slice(0, 20)}...
                                </button>
                              )}
                            </td>
                          );
                        }

                        if (columnKey === "adminremark") {
                          return (
                            <td key={columnKey} data-colkey={columnKey} style={style}>
                              <textarea
                                className="item-master-remark-input"
                                value={adminRemarkValue}
                                onChange={(event) =>
                                  setRemarkDraft((previous) => ({
                                    ...previous,
                                    [item.id]: event.target.value
                                  }))
                                }
                                onBlur={() => void saveAdminRemark(item)}
                              />
                            </td>
                          );
                        }

                        if (columnKey === "photos") {
                          return (
                            <td key={columnKey} data-colkey={columnKey} style={style}>
                              {photoCount > 0 ? (
                                <button type="button" className="photo-link-btn" onClick={() => setPhotoItem(item)}>
                                  Photos ({photoCount})
                                </button>
                              ) : (
                                <span className="qty-null">-</span>
                              )}
                            </td>
                          );
                        }

                        if (columnKey === "pair") {
                          return (
                            <td key={columnKey} data-colkey={columnKey} style={style}>
                              {item.countQty !== null && item.countQty !== undefined ? (
                                item.assignedTo || "-"
                              ) : (
                                <select
                                  className="select"
                                  style={{ width: "auto", fontSize: 11 }}
                                  value={item.assignedPair ?? ""}
                                  onChange={(event) => void updateItemPair(item, event.target.value)}
                                >
                                  <option value="">-</option>
                                  {pairs.map((pair) => (
                                    <option key={pair.id} value={pair.id}>
                                      {pair.counter} / {pair.checker}{pair.counter2 ? ` / ${pair.counter2}` : ""}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                          );
                        }

                        if (columnKey === "src") {
                          return (
                            <td key={columnKey} data-colkey={columnKey} style={style}>
                              <span className={countStatusBadgeClass(countStatus)}>{countStatus}</span>
                            </td>
                          );
                        }

                        if (columnKey === "p1bin") {
                          return <td key={columnKey} data-colkey={columnKey} style={style}>{firstCount?.bin || "-"}</td>;
                        }

                        if (columnKey === "p1by") {
                          return <td key={columnKey} data-colkey={columnKey} style={style}>{firstCount?.by || "-"}</td>;
                        }

                        if (columnKey === "p1cnt") {
                          return (
                            <td key={columnKey} data-colkey={columnKey} style={style}>
                              {firstCount?.qty ?? "-"}
                            </td>
                          );
                        }

                        return (
                          <td key={columnKey} data-colkey={columnKey} style={style}>
                            <button
                              type="button"
                              className={`btn btn-sm ${item.dropped ? "rec-btn" : "drop-btn"}`}
                              onClick={() => void updateItem.mutateAsync({ itemId: item.id, dropped: !item.dropped })}
                            >
                              {item.dropped ? "Recover" : "Drop"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="item-master-pager">
            <span className="item-master-pager-info">{pagerInfo}</span>
            <div className="item-master-pager-actions">
              <button type="button" className="btn btn-sm" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                Prev
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={safePage >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {photoItem ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Item Photos">
          <section className="modal">
            <header>
              <h2>
                {photoItem.code} - Photos
              </h2>
              <button type="button" onClick={() => setPhotoItem(null)} className="ghost-btn">
                X
              </button>
            </header>
            {(photoItem.photos ?? []).length === 0 ? (
              <p>No photos found for this item.</p>
            ) : (
              <div className="photo-grid">
                {(photoItem.photos ?? []).map((src, index) => (
                  <img key={`${photoItem.id}-${index}`} src={src} alt={`${photoItem.code}-${index + 1}`} />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {remarkPopupText ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Remark">
          <section className="modal remark-modal">
            <header>
              <h2>Remark</h2>
              <button type="button" onClick={() => setRemarkPopupText(null)} className="ghost-btn">
                X
              </button>
            </header>
            <p className="remark-modal-body">{remarkPopupText}</p>
          </section>
        </div>
      ) : null}

      {showImportModal ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Import from SAP">
          <section className="modal">
            <header>
              <h2>Import from SAP</h2>
              {!importItems.isPending ? (
                <button type="button" onClick={() => setShowImportModal(false)} className="ghost-btn">
                  X
                </button>
              ) : null}
            </header>
            {importItems.isPending ? (
              <div className="banner warning">
                Import in progress — this may take a few minutes. Please stay on this screen.
              </div>
            ) : (
              <div className="banner warning">
                This will delete all existing items for this session and reimport everything fresh from SAP. All count quantities, pair assignments, and statuses will be lost. This cannot be undone.
              </div>
            )}
            <footer>
              <button type="button" onClick={() => setShowImportModal(false)} disabled={importItems.isPending}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-btn"
                disabled={importItems.isPending}
                onClick={async () => {
                  try {
                    await importItems.mutateAsync({ entity });
                    setShowImportModal(false);
                  } catch (error) {
                    setFeedback({
                      type: "warning",
                      text: (error as Error).message || "Import failed."
                    });
                    setShowImportModal(false);
                  }
                }}
              >
                {importItems.isPending ? "Importing, please wait..." : "Confirm Import"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {bulkLoadingAction !== null ? (
        <div className="bulk-action-overlay">
          <span className="bulk-action-spinner" />
          <span className="bulk-action-label">
            {bulkLoadingAction === "drop" ? "Bulk dropping items…" : "Bulk recovering items…"}
          </span>
        </div>
      ) : null}
    </section>
  );
}

