import { useEffect, useMemo, useState } from "react";
import { CameraScanner } from "../components/warehouse/CameraScanner";
import { CountInputForm } from "../components/warehouse/CountInputForm";
import { QuantityField } from "../components/ui/QuantityField";
import { WarehouseGallery } from "../components/warehouse/WarehouseGallery";
import { useIdentity } from "../app/IdentityContext";
import { useCreateNewItemMutation, useScanAttendanceMutation, useSessionsQuery } from "../hooks/useAdminData";
import { useAssignedItemsBySessionQuery, useBinsQuery, useSubmitCountMutation, useWarehouseSearchBySessionQuery, useWhCodesQuery } from "../hooks/useWarehouseData";

interface MultiScanLogEntry {
  id: string;
  level: "success" | "warning" | "danger";
  text: string;
  code?: string;
  canAdd?: boolean;
}

const COUNT_SESSION_STORAGE_KEY = "stp_count_sess";

export function WarehousePage() {
  const { identity } = useIdentity();
  const { data: sessions = [] } = useSessionsQuery();
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [query, setQuery] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerCode, setScannerCode] = useState("");
  const [multiScanOpen, setMultiScanOpen] = useState(false);
  const [multiScanInput, setMultiScanInput] = useState("");
  const [multiScanLogs, setMultiScanLogs] = useState<MultiScanLogEntry[]>([]);
  const [multiScanCount, setMultiScanCount] = useState(0);
  const [multiScanNotice, setMultiScanNotice] = useState("");
  const [multiScanSubmitting, setMultiScanSubmitting] = useState(false);
  const [multiScanLastScan, setMultiScanLastScan] = useState<{ code: string; time: number } | null>(null);
  const [multiScanCountOverrides, setMultiScanCountOverrides] = useState<Record<string, number>>({});
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [newItemCode, setNewItemCode] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemUom, setNewItemUom] = useState("");
  const [newItemBatch, setNewItemBatch] = useState("");
  const [newItemWarehouse, setNewItemWarehouse] = useState("");
  const [newItemQty, setNewItemQty] = useState<number | null>(null);
  const [newItemDamagedQty, setNewItemDamagedQty] = useState<number | null>(null);
  const [newItemExpiredQty, setNewItemExpiredQty] = useState<number | null>(null);
  const [newItemRemark, setNewItemRemark] = useState("");
  const [newItemPhotos, setNewItemPhotos] = useState<string[]>([]);
  const [newItemError, setNewItemError] = useState("");
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [scannerNotice, setScannerNotice] = useState<{ type: "success" | "warning"; text: string } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const allItemsQuery = useWarehouseSearchBySessionQuery("", selectedSessionId || undefined, Boolean(selectedSessionId));
  const assignedQuery = useAssignedItemsBySessionQuery(
    undefined,
    selectedSessionId || undefined,
    identity?.name,
    Boolean(selectedSessionId)
  );
  const submitCount = useSubmitCountMutation();
  const scanAttendance = useScanAttendanceMutation();
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? null;
  const createNewItem = useCreateNewItemMutation(selectedSessionId || "");

  const allSessionItems = useMemo(() => allItemsQuery.data ?? [], [allItemsQuery.data]);
  const assignedItems = useMemo(() => assignedQuery.data ?? [], [assignedQuery.data]);
  const activeVisibleSessions = sessions.filter((session) => session.status === "Active" && session.userVisible);
  const isAdminOrSuperAdmin = identity?.role === "Admin" || identity?.role === "Super Admin";
  const showNewItemAction = !selectedSession?.isRecount;

  useEffect(() => {
    if (selectedSessionId) return;
    const saved = localStorage.getItem(COUNT_SESSION_STORAGE_KEY);
    if (!saved) return;

    const matched = activeVisibleSessions.find((session) => session.id === saved);
    if (matched) {
      setSelectedSessionId(matched.id);
      return;
    }

    localStorage.removeItem(COUNT_SESSION_STORAGE_KEY);
  }, [activeVisibleSessions, selectedSessionId]);

  useEffect(() => {
    if (!selectedSessionId) return;
    localStorage.setItem(COUNT_SESSION_STORAGE_KEY, selectedSessionId);
  }, [selectedSessionId]);

  useEffect(() => {
    const onLayoutOpen = () => setLayoutOpen(true);
    window.addEventListener("sta-mobile-layout", onLayoutOpen);
    return () => {
      window.removeEventListener("sta-mobile-layout", onLayoutOpen);
    };
  }, []);

  useEffect(() => {
    if (!activeItemId) return;
    history.pushState({ activeItemId }, "");
  }, [activeItemId]);

  useEffect(() => {
    const onPopState = () => setActiveItemId(null);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const { data: fetchedBins = [] } = useBinsQuery(Boolean(activeItemId));
  const { data: fetchedWhCodes = [] } = useWhCodesQuery(selectedSessionId || undefined, Boolean(selectedSessionId));

  const warehouseOptions = useMemo(
    () => Array.from(new Set(allSessionItems.map((item) => item.warehouse).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [allSessionItems]
  );

  const whCodeOptions = fetchedWhCodes;

  const binOptions = useMemo(
    () => fetchedBins.length > 0 ? fetchedBins : warehouseOptions,
    [fetchedBins, warehouseOptions]
  );

  const filteredWarehouseItems = useMemo(
    () => allSessionItems.filter((item) => !warehouseFilter || item.whCode === warehouseFilter),
    [allSessionItems, warehouseFilter]
  );

  const queryTrimmed = query.trim();
  const queryLower = queryTrimmed.toLowerCase();

  const exactCodeMatches = useMemo(() => {
    if (!queryLower) return [];
    return filteredWarehouseItems.filter((item) => item.code.toLowerCase() === queryLower);
  }, [filteredWarehouseItems, queryLower]);

  const searchResults = useMemo(() => {
    if (!queryLower) return [];
    if (exactCodeMatches.length > 0) return exactCodeMatches;
    return filteredWarehouseItems.filter((item) => {
      return (
        item.code.toLowerCase().startsWith(queryLower) ||
        item.name.toLowerCase().includes(queryLower) ||
        (item.batch && item.batch.toLowerCase().includes(queryLower))
      );
    });
  }, [exactCodeMatches, filteredWarehouseItems, queryLower]);

  const searchMatchesAcrossWarehouses = useMemo(
    () =>
      queryLower
        ? allSessionItems.filter((item) => {
            return (
              item.code.toLowerCase().startsWith(queryLower) ||
              item.name.toLowerCase().includes(queryLower) ||
              (item.batch && item.batch.toLowerCase().includes(queryLower))
            );
          })
        : [],
    [allSessionItems, queryLower]
  );

  const showNoResults = Boolean(queryTrimmed) && !allItemsQuery.isLoading && searchResults.length === 0;
  const hasCrossWarehouseMatches = Boolean(warehouseFilter) && searchMatchesAcrossWarehouses.length > 0;

  const selectableItems = useMemo(() => {
    const deduped = new Map<string, (typeof allSessionItems)[number]>();
    [...allSessionItems, ...assignedItems].forEach((item) => {
      deduped.set(item.id, item);
    });
    return Array.from(deduped.values());
  }, [allSessionItems, assignedItems]);
  const scanMatchPool = useMemo(() => {
    if (filteredWarehouseItems.length > 0) return filteredWarehouseItems;
    return selectableItems.filter((item) => !warehouseFilter || item.warehouse === warehouseFilter);
  }, [filteredWarehouseItems, selectableItems, warehouseFilter]);
  const scannerCodeNorm = scannerCode.trim().toLowerCase();
  const scannerMatched =
    scannerCodeNorm.length > 0
      ? (scanMatchPool.find(
          (item) =>
            item.code.toLowerCase() === scannerCodeNorm ||
            (item.batch && item.batch.toLowerCase() === scannerCodeNorm)
        ) ?? null)
      : null;
  const isAttendanceToken = scannerCode.trim().toLowerCase().startsWith("att:");

  const activeItem = useMemo(
    () => selectableItems.find((item) => item.id === activeItemId) ?? null,
    [activeItemId, selectableItems]
  );

  const parseOptionalNonNegativeNumber = (value: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return Number.NaN;
    }
    return parsed;
  };

  const openNewItem = (prefillCode = "") => {
    setNewItemCode(prefillCode);
    setNewItemName("");
    setNewItemUom("");
    setNewItemBatch("");
    setNewItemWarehouse(warehouseFilter || "");
    setNewItemQty(null);
    setNewItemDamagedQty(null);
    setNewItemExpiredQty(null);
    setNewItemRemark("");
    setNewItemPhotos([]);
    setNewItemError("");
    setNewItemOpen(true);
  };

  const openMultiScan = () => {
    setMultiScanInput("");
    setMultiScanLogs([]);
    setMultiScanCount(0);
    setMultiScanNotice("");
    setMultiScanSubmitting(false);
    setMultiScanLastScan(null);
    setMultiScanCountOverrides({});
    setMultiScanOpen(true);
  };

  const appendMultiScanLog = (entry: Omit<MultiScanLogEntry, "id">) => {
    const id = `ms-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setMultiScanLogs((prev) => [{ id, ...entry }, ...prev].slice(0, 80));
  };

  const processMultiScan = async () => {
    const code = multiScanInput.trim();
    if (!code || multiScanSubmitting) return;
    setMultiScanInput("");
    const lowerCode = code.toLowerCase();
    const now = Date.now();

    if (multiScanLastScan && multiScanLastScan.code === lowerCode && now - multiScanLastScan.time < 500) {
      return;
    }
    setMultiScanLastScan({ code: lowerCode, time: now });

    const match = scanMatchPool.find((item) => item.code.toLowerCase() === lowerCode);
    if (!match) {
      setMultiScanNotice(`${code} is not found in item master.`);
      appendMultiScanLog({
        level: "danger",
        text: `${code} - not found in item master`,
        code,
        canAdd: showNewItemAction
      });
      return;
    }

    const effectiveCount = multiScanCountOverrides[match.id] ?? match.countQty;
    if (effectiveCount !== null && effectiveCount !== undefined) {
      setMultiScanNotice(`${match.code} is already counted (Qty: ${effectiveCount}).`);
      appendMultiScanLog({
        level: "warning",
        text: `${match.code} already counted - skipped`
      });
      return;
    }

    const nextQty = (effectiveCount ?? 0) + 1;
    setMultiScanSubmitting(true);
    try {
      await submitCount.mutateAsync({
        itemId: match.id,
        qty: nextQty,
        submittedBy: identity?.name || "MultiScan",
        remark: "Scanned via multi-scan"
      });
      setMultiScanCount((prev) => prev + 1);
      setMultiScanNotice("");
      setMultiScanCountOverrides((prev) => ({ ...prev, [match.id]: nextQty }));
      appendMultiScanLog({
        level: "success",
        text: `Updated ${match.code} -> ${nextQty}`
      });
    } catch (error) {
      setMultiScanNotice((error as Error).message || "Failed to save scan.");
      appendMultiScanLog({
        level: "danger",
        text: `Failed to update ${match.code}`
      });
    } finally {
      setMultiScanSubmitting(false);
    }
  };

  useEffect(() => {
    if (!queryTrimmed) return;
    if (searchResults.length === 1 && activeItemId !== searchResults[0].id) {
      setActiveItemId(searchResults[0].id);
    }
  }, [activeItemId, searchResults, queryTrimmed]);

  useEffect(() => {
    if (activeItemId && !selectableItems.some((item) => item.id === activeItemId)) {
      setActiveItemId(null);
    }
  }, [activeItemId, selectableItems]);

  if (!selectedSessionId) {
    return (
      <section className="panel">
        <h2 className="cv-select-title">Select Session</h2>
        <div className="cv-page-header">
          <div className="cv-page-title">Scan & Count</div>
          <div className="cv-page-sub">Select a session to begin counting</div>
        </div>

        {activeVisibleSessions.length === 0 ? (
          <div className="banner">No active sessions are currently available. Ask an admin to enable a session.</div>
        ) : null}

        <div className="ush-grid">
          {activeVisibleSessions.map((session) => (
            <article
              key={session.id}
              className="ush-card"
              onClick={() => {
                setSelectedSessionId(session.id);
                setActiveItemId(null);
                setQuery("");
                setWarehouseFilter("");
                localStorage.setItem(COUNT_SESSION_STORAGE_KEY, session.id);
              }}
            >
              <div className="ush-card-name">{session.name}</div>
              <div className="ush-card-meta">
                {session.id}
                <br />
                {session.entity} - {session.country}
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="warehouse-page">
      <section className="panel">
        <div className="cv-active-bar" id="cv-active-bar">
          <div className="cv-session-info">
            <div className="cv-active-dot" />
            <span className="cv-active-name" id="cv-active-name">
              {selectedSession?.name || selectedSessionId}
            </span>
            <button
              className="cv-active-change"
              onClick={() => {
                setSelectedSessionId("");
                setActiveItemId(null);
                setQuery("");
                setWarehouseFilter("");
                localStorage.removeItem(COUNT_SESSION_STORAGE_KEY);
              }}
            >
              Change Session
            </button>
          </div>
          <div className="cv-wh-group">
            <select className="cv-wh-inline-sel" value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)}>
              <option value="">All WH</option>
              {whCodeOptions.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="cv-search-block">
          <div className="cv-search-row">
            <input
              className="cv-search-input"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Item code, name or batch..."
            />
          </div>

          {!activeItem ? (
            <div className="cv-action-row">
              <button type="button" className="cv-btn-action-secondary cv-btn-layout" onClick={() => setLayoutOpen(true)}>
                Layout
              </button>
              <button type="button" className="cv-btn-action-primary" onClick={() => setCameraOpen(true)}>
                Scan
              </button>
              {isAdminOrSuperAdmin ? (
                <button type="button" className="cv-btn-action-secondary cv-btn-multiscan" onClick={openMultiScan}>
                  Multi-Scan
                </button>
              ) : null}
              {showNewItemAction ? (
                <button type="button" className="cv-btn-action-secondary cv-btn-new" onClick={() => openNewItem()}>
                  + New
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {!activeItem ? (
        <>
          {queryTrimmed && allItemsQuery.isLoading ? (
            <section className="panel">
              <p>Loading items...</p>
            </section>
          ) : null}
          {queryTrimmed && searchResults.length > 0 ? (
            <WarehouseGallery
              title="Search Results Gallery"
              items={searchResults}
              loading={allItemsQuery.isLoading}
              selectedItemId={activeItemId}
              onSelectItem={(item) => setActiveItemId(item.id)}
            />
          ) : null}
          {showNoResults ? (
            <section className="panel cv-empty-panel">
              <div className="cv-empty-msg">No items matched your search.</div>
              {hasCrossWarehouseMatches ? (
                <div className="cv-wh-hint">
                  <div>No match in <strong>{warehouseFilter}</strong>. Found in other warehouse codes:</div>
                  <div className="cv-wh-hint-list">
                    {searchMatchesAcrossWarehouses
                      .filter((item) => item.whCode !== warehouseFilter)
                      .slice(0, 5)
                      .map((item) => (
                        <div key={item.id} className="cv-wh-hint-item">
                          <span className="cv-wh-hint-code">{item.whCode || item.warehouse}</span>
                          <span>{item.code} — {item.name}{item.batch ? ` (${item.batch})` : ""}</span>
                        </div>
                      ))}
                  </div>
                  <button type="button" className="btn btn-sm" onClick={() => setWarehouseFilter("")}>
                    Search all warehouse codes
                  </button>
                </div>
              ) : null}
              {showNewItemAction ? (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => openNewItem(queryTrimmed)}>
                  + Add as new item
                </button>
              ) : null}
            </section>
          ) : null}
          <WarehouseGallery
            title=""
            items={assignedItems}
            loading={assignedQuery.isLoading}
            selectedItemId={activeItemId}
            onSelectItem={(item) => setActiveItemId(item.id)}
          />
        </>
      ) : (
        <CountInputForm
          items={selectableItems}
          selectedItem={activeItem}
          onBack={() => { setActiveItemId(null); setQuery(""); }}
          initialSubmittedBy={identity?.name || "Counter"}
          isRecount={selectedSession?.isRecount ?? false}
          binOptions={binOptions}
          onSubmit={async (input) => {
            await submitCount.mutateAsync({
              ...input,
              submittedBy: identity?.name || input.submittedBy
            });
          }}
        />
      )}

      {cameraOpen ? (
        <CameraScanner
          onDetected={(code) => {
            setScannerCode(code);
            setScannerNotice(null);
            setCameraOpen(false);
            setScannerOpen(true);
          }}
          onClose={() => setCameraOpen(false)}
        />
      ) : null}

      {scannerOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Scanner">
          <section className="modal">
            <header>
              <h2>Scanner</h2>
              <button type="button" onClick={() => setScannerOpen(false)} className="ghost-btn">
                X
              </button>
            </header>
            <label>
              Scanned Code
              <input
                value={scannerCode}
                onChange={(event) => {
                  setScannerCode(event.target.value);
                  setScannerNotice(null);
                }}
                placeholder="Scan item barcode or attendance QR token..."
              />
            </label>
            {isAttendanceToken ? (
              <div className="banner">Attendance token detected. Click "Mark Attendance" to sync.</div>
            ) : scannerMatched ? (
              <div className="banner success">
                Match found: {scannerMatched.code} - {scannerMatched.name} ({scannerMatched.warehouse})
              </div>
            ) : (
              <div className="banner warning">No exact match yet.</div>
            )}
            {scannerNotice ? <div className={`banner ${scannerNotice.type}`}>{scannerNotice.text}</div> : null}
            <footer>
              <button type="button" onClick={() => setScannerOpen(false)}>
                Close
              </button>
              <button
                type="button"
                className="primary-btn"
                disabled={!isAttendanceToken || scanAttendance.isPending}
                onClick={async () => {
                  try {
                    const userId = identity?.id || (identity?.name ? identity.name.toLowerCase().replace(/\s+/g, "_") : "warehouse_user");
                    const result = await scanAttendance.mutateAsync({
                      token: scannerCode.trim(),
                      userId,
                      name: identity?.name || "Warehouse User"
                    });
                    setScannerNotice({
                      type: "success",
                      text: `${result.message} (${result.sessionId})`
                    });
                  } catch (error) {
                    setScannerNotice({
                      type: "warning",
                      text: (error as Error).message || "Failed to mark attendance."
                    });
                  }
                }}
              >
                {scanAttendance.isPending ? "Marking..." : "Mark Attendance"}
              </button>
              <button
                type="button"
                className="primary-btn"
                disabled={!scannerMatched}
                onClick={async () => {
                  if (!scannerMatched) return;
                  await submitCount.mutateAsync({
                    itemId: scannerMatched.id,
                    qty: (scannerMatched.countQty ?? 0) + 1,
                    submittedBy: identity?.name || "Scanner",
                    remark: "Scanned via single scan"
                  });
                  setActiveItemId(scannerMatched.id);
                  setScannerOpen(false);
                }}
              >
                +1 Count
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {multiScanOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Multi Scan">
          <section className="modal modal-wide">
            <div className="cv-multiscan-header">
              <div>
                <div className="cv-page-title">Multiple Scan</div>
                <div className="cv-page-sub">Each scan adds 1 unit to count qty</div>
              </div>
              <button type="button" className="cv-close-btn" onClick={() => setMultiScanOpen(false)}>
                X Done
              </button>
            </div>

            <div className="cv-form-section">
              <label>
                Point scanner here and scan
                <input
                  className="cv-field-input cv-ms-input"
                  value={multiScanInput}
                  onChange={(event) => setMultiScanInput(event.target.value)}
                  placeholder="Waiting for scan..."
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void processMultiScan();
                    }
                  }}
                />
              </label>
              <div className="actions">
                <button type="button" className="primary-btn" onClick={() => void processMultiScan()} disabled={multiScanSubmitting}>
                  {multiScanSubmitting ? "Saving..." : "Process Scan"}
                </button>
              </div>
              {multiScanNotice ? <div className="banner warning">{multiScanNotice}</div> : null}
            </div>

            {multiScanCount > 0 ? (
              <div className="cv-ms-counter">
                <div className="cv-ms-num">{multiScanCount}</div>
                <div>
                  <div className="cv-ms-count-title">items scanned</div>
                  <div className="cv-ms-count-sub">this session</div>
                </div>
              </div>
            ) : null}

            <div className="cv-log-header">Scan log</div>
            <div className="cv-ms-log">
              {multiScanLogs.length === 0 ? (
                <div className="muted">No scans yet.</div>
              ) : (
                multiScanLogs.map((log) => (
                  <article key={log.id} className={`cv-ms-entry cv-ms-entry-${log.level}`}>
                    <span className="cv-ms-entry-text">{log.text}</span>
                    {log.canAdd && log.code && showNewItemAction ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          setMultiScanOpen(false);
                          openNewItem(log.code ?? "");
                        }}
                      >
                        + Add
                      </button>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}

      {newItemOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="New Item">
          <form
            className="modal modal-wide"
            onSubmit={async (event) => {
              event.preventDefault();
              setNewItemError("");
              if (!selectedSessionId) {
                setNewItemError("Please select a session first.");
                return;
              }

              const code = newItemCode.trim();
              const name = newItemName.trim();
              const uom = newItemUom.trim();
              const batch = newItemBatch.trim();
              const warehouse = newItemWarehouse.trim();
              if (!code || !name || !uom || !batch || !warehouse) {
                setNewItemError("Item code, name, UOM, serial/batch number, and bin location are required.");
                return;
              }
              if (newItemQty === null) {
                setNewItemError("Counted qty is required and must be zero or more.");
                return;
              }
              if (newItemPhotos.length === 0) {
                setNewItemError("At least one photo is required.");
                return;
              }

              try {
                await createNewItem.mutateAsync({
                  code,
                  name,
                  uom,
                  batch,
                  warehouse,
                  qty: newItemQty,
                  damagedQty: newItemDamagedQty,
                  expiredQty: newItemExpiredQty,
                  remark: newItemRemark.trim() || undefined,
                  photos: newItemPhotos,
                  submittedBy: identity?.name || "Warehouse User"
                });

                setNewItemOpen(false);
                setNewItemCode("");
                setNewItemName("");
                setNewItemUom("");
                setNewItemBatch("");
                setNewItemWarehouse("");
                setNewItemQty(null);
                setNewItemDamagedQty(null);
                setNewItemExpiredQty(null);
                setNewItemRemark("");
                setNewItemPhotos([]);
                setNewItemError("");
              } catch (error) {
                setNewItemError((error as Error).message || "Failed to submit new item.");
              }
            }}
          >
            <header>
              <h2>Add New Item</h2>
              <button
                type="button"
                onClick={() => {
                  setNewItemOpen(false);
                  setNewItemError("");
                }}
                className="ghost-btn"
              >
                X
              </button>
            </header>
            <p className="cv-page-sub">Not in SAP master - submit for admin review.</p>
            <div className="cv-form-section">
              <div className="count-form-grid">
                <label>
                  Item Code
                  <input className="cv-field-input" value={newItemCode} onChange={(event) => setNewItemCode(event.target.value)} />
                </label>
                <label>
                  Item Name
                  <input className="cv-field-input" value={newItemName} onChange={(event) => setNewItemName(event.target.value)} />
                </label>
                <label>
                  UOM
                  <input className="cv-field-input" value={newItemUom} onChange={(event) => setNewItemUom(event.target.value)} />
                </label>
                <label>
                  Serial / Batch No.
                  <input className="cv-field-input" value={newItemBatch} onChange={(event) => setNewItemBatch(event.target.value)} />
                </label>
                <label>
                  Bin Location
                  <select className="cv-field-input" value={newItemWarehouse} onChange={(event) => setNewItemWarehouse(event.target.value)}>
                    <option value="">Select bin...</option>
                    {warehouseOptions.map((wh) => (
                      <option key={wh} value={wh}>{wh}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Counted Qty
                  <QuantityField value={newItemQty} onChange={setNewItemQty} />
                </label>
                <label>
                  Damaged Qty
                  <QuantityField value={newItemDamagedQty} onChange={setNewItemDamagedQty} />
                </label>
                <label>
                  Expired Qty
                  <QuantityField value={newItemExpiredQty} onChange={setNewItemExpiredQty} />
                </label>
                <label className="count-form-full">
                  Remark
                  <textarea className="cv-textarea" rows={2} value={newItemRemark} onChange={(event) => setNewItemRemark(event.target.value)} />
                </label>
                <div className="count-form-full">
                  <label htmlFor="new-item-photo-input">Photos (at least one required)</label>
                  <input
                    id="new-item-photo-input"
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: "none" }}
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      setNewItemPhotos(files.map((file) => file.name));
                    }}
                  />
                  <label htmlFor="new-item-photo-input" className="cv-photo-btn" style={{ cursor: "pointer" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{newItemPhotos.length > 0 ? "Change Photos" : "Add Photos"}</div>
                      <div className="cv-photo-sub">
                        {newItemPhotos.length === 0 ? "No photos selected" : `${newItemPhotos.length} photo(s) selected`}
                      </div>
                    </div>
                  </label>
                  {newItemPhotos.length > 0 ? (
                    <div className="photo-preview-row">
                      {newItemPhotos.map((photo) => (
                        <span key={photo} className="photo-preview-chip">
                          {photo}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              {newItemError ? <div className="banner warning">{newItemError}</div> : null}
              <button type="submit" className="primary-btn" disabled={createNewItem.isPending}>
                {createNewItem.isPending ? "Submitting..." : "Submit New Item"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {layoutOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Warehouse Layout">
          <section className="modal">
            <header>
              <h2>Warehouse Layout</h2>
              <button type="button" onClick={() => setLayoutOpen(false)} className="ghost-btn">
                X
              </button>
            </header>
            <p>Tap a zone to view details.</p>
            <div className="layout-grid">
              {warehouseOptions.map((warehouse) => (
                <button key={warehouse} type="button" className="layout-tile">
                  {warehouse}
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
