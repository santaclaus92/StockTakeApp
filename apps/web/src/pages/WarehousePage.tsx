import { useEffect, useMemo, useRef, useState } from "react";
import { CameraScanner } from "../components/warehouse/CameraScanner";
import { CountInputForm } from "../components/warehouse/CountInputForm";
import { QuantityField } from "../components/ui/QuantityField";
import { WarehouseGallery } from "../components/warehouse/WarehouseGallery";
import { BannerModal } from "../components/ui/BannerModal";
import { useIdentity } from "../app/IdentityContext";
import { useCreateNewItemMutation, useItemsQuery, useScanAttendanceMutation, useSessionsQuery } from "../hooks/useAdminData";
import { useAssignedItemsBySessionQuery, useBinsQuery, useSubmitCountMutation, useWarehouseSearchBySessionQuery } from "../hooks/useWarehouseData";
import { uploadPhoto } from "../services/photoUpload";

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
  const [scanNotFound, setScanNotFound] = useState<string | null>(null);
  const [attendanceNotice, setAttendanceNotice] = useState<{ type: "success" | "warning"; text: string } | null>(null);
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
  const [noSessionsDismissed, setNoSessionsDismissed] = useState(false);
  const [newItemBinScanOpen, setNewItemBinScanOpen] = useState(false);
  const newItemPhotoRef = useRef<HTMLInputElement>(null);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scannedBin, setScannedBin] = useState<string | null>(null);

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
  const parentSessionId = selectedSession?.parentId ?? null;
  const parentItemsQuery = useItemsQuery(parentSessionId ?? "", Boolean(parentSessionId));
  const parentFirstCountIndex = useMemo(() => {
    const byCodeBatch = new Map<string, number | null>();
    const byCode = new Map<string, Array<{ id: string; countQty: number | null; batch: string | null }>>();
    (parentItemsQuery.data ?? []).forEach((item) => {
      const rawCode = item.code ?? "";
      const code = rawCode.trim();
      if (!code) return;
      const codeKey = code.toLowerCase();
      const batch = (item.batch ?? "").trim();
      const batchKey = batch.toLowerCase();
      byCodeBatch.set(`${codeKey}::${batchKey}`, item.countQty ?? null);
      const list = byCode.get(codeKey) ?? [];
      list.push({ id: item.id, countQty: item.countQty ?? null, batch: item.batch ?? null });
      byCode.set(codeKey, list);
    });
    return { byCodeBatch, byCode };
  }, [parentItemsQuery.data]);
  const createNewItem = useCreateNewItemMutation(selectedSessionId || "");

  const allSessionItems = useMemo(() => allItemsQuery.data ?? [], [allItemsQuery.data]);
  const assignedItems = useMemo(() => {
    const items = assignedQuery.data ?? [];
    if (!selectedSession?.isRecount) return items;
    // For recount: uncounted first, then sort by bin location
    return [...items].sort((a, b) => {
      const aUncounted = a.countQty === null || a.countQty === undefined ? 0 : 1;
      const bUncounted = b.countQty === null || b.countQty === undefined ? 0 : 1;
      if (aUncounted !== bUncounted) return aUncounted - bUncounted;
      return (a.warehouse ?? "").localeCompare(b.warehouse ?? "");
    });
  }, [assignedQuery.data, selectedSession?.isRecount]);
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

  const { data: fetchedBins = [] } = useBinsQuery(Boolean(activeItemId) || newItemOpen);

  const warehouseOptions = useMemo(
    () => Array.from(new Set(allSessionItems.map((item) => item.warehouse).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [allSessionItems]
  );

  const whCodeOptions = useMemo(
    () => Array.from(new Set(allSessionItems.map((item) => item.whCode).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [allSessionItems]
  );

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

  const isSingaporeSession = selectedSession?.country === "Singapore";

  const scannedBinItems = useMemo(() => {
    if (!scannedBin) return [];
    return allSessionItems
      .filter((item) => item.warehouse === scannedBin)
      .sort((a, b) => {
        const aUncounted = a.countQty === null || a.countQty === undefined ? 0 : 1;
        const bUncounted = b.countQty === null || b.countQty === undefined ? 0 : 1;
        return aUncounted - bUncounted;
      });
  }, [scannedBin, allSessionItems]);

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
  const activeItem = useMemo(
    () => selectableItems.find((item) => item.id === activeItemId) ?? null,
    [activeItemId, selectableItems]
  );
  const activeFirstCountQty = useMemo(() => {
    if (!activeItem) return null;
    const code = activeItem.code?.trim?.() ?? "";
    if (!code) return null;
    const codeKey = code.toLowerCase();
    const batchKey = ((activeItem.batch ?? "").trim()).toLowerCase();

    // Preferred: exact code+batch match (fast + precise)
    const direct = parentFirstCountIndex.byCodeBatch.get(`${codeKey}::${batchKey}`);
    if (direct !== undefined) return direct ?? null;

    // Fallback: if code uniquely identifies the parent item, use it (batch can be missing in recount items)
    const matches = parentFirstCountIndex.byCode.get(codeKey) ?? [];
    if (matches.length === 1) return matches[0].countQty ?? null;

    return null;
  }, [activeItem, parentFirstCountIndex]);

  useEffect(() => {
    if (!selectedSession?.isRecount) return;
    if (!activeItem) return;
  }, [activeItem, selectedSession?.isRecount]);

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
    setNewItemWarehouse("");
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

        {activeVisibleSessions.length === 0 && !noSessionsDismissed ? (
          <BannerModal
            message="No active sessions are currently available. Ask an admin to enable a session."
            onClose={() => setNoSessionsDismissed(true)}
          />
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
                setScannedBin(null);
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

        {!activeItem && !newItemOpen ? (
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
          </div>
        ) : null}
      </section>

      {!activeItem ? (
        <>
          {scannedBin ? (
            <section className="panel">
              <div className="cv-bin-scan-header">
                <div>
                  <div className="cv-page-title">Bin: {scannedBin}</div>
                  <div className="cv-page-sub">{scannedBinItems.length} item(s) — uncounted shown first</div>
                </div>
                <button type="button" className="cv-active-change" onClick={() => setScannedBin(null)}>Clear</button>
              </div>
              {scannedBinItems.length === 0 ? (
                <div className="cv-empty-msg">No items found in this bin.</div>
              ) : (
                <WarehouseGallery
                  title=""
                  items={scannedBinItems}
                  loading={allItemsQuery.isLoading}
                  selectedItemId={activeItemId}
                  onSelectItem={(item) => { setScannedBin(null); setActiveItemId(item.id); }}
                />
              )}
            </section>
          ) : (
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
              {showNoResults && !newItemOpen ? (
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
              {!newItemOpen ? (
                <WarehouseGallery
                  title=""
                  items={assignedItems}
                  loading={assignedQuery.isLoading}
                  selectedItemId={activeItemId}
                  onSelectItem={(item) => setActiveItemId(item.id)}
                />
              ) : null}
            </>
          )}
        </>
      ) : (
        <CountInputForm
          items={selectableItems}
          selectedItem={activeItem}
          onBack={() => { setActiveItemId(null); setQuery(""); }}
          initialSubmittedBy={identity?.name || "Counter"}
          isRecount={selectedSession?.isRecount ?? false}
          firstCountQty={activeFirstCountQty}
          binOptions={binOptions}
          onSubmit={async (input) => {
            await submitCount.mutateAsync({
              ...input,
              submittedBy: identity?.name || input.submittedBy
            });
          }}
        />
      )}

      {attendanceNotice ? (
        <BannerModal
          type={attendanceNotice.type}
          message={attendanceNotice.text}
          onClose={() => setAttendanceNotice(null)}
        />
      ) : null}

      {scanNotFound ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Item Not Found">
          <section className="modal">
            <header>
              <h2>Item Not Found</h2>
              <button type="button" onClick={() => setScanNotFound(null)} className="ghost-btn">X</button>
            </header>
            <p>No item matched <strong>{scanNotFound}</strong>.</p>
            <footer>
              <button type="button" onClick={() => setScanNotFound(null)}>Cancel</button>
              {showNewItemAction ? (
                <button type="button" className="primary-btn" onClick={() => { openNewItem(scanNotFound); setScanNotFound(null); }}>
                  + Create New Item
                </button>
              ) : null}
            </footer>
          </section>
        </div>
      ) : null}

      {cameraOpen ? (
        <CameraScanner
          onDetected={async (code) => {
            setCameraOpen(false);
            const trimmedCode = code.trim();
            const lowerCode = trimmedCode.toLowerCase();
            if (lowerCode.startsWith("att:")) {
              try {
                const userId = identity?.id || (identity?.name ? identity.name.toLowerCase().replace(/\s+/g, "_") : "warehouse_user");
                const result = await scanAttendance.mutateAsync({ token: trimmedCode, userId, name: identity?.name || "Warehouse User" });
                setAttendanceNotice({ type: "success", text: `${result.message} (${result.sessionId})` });
              } catch (error) {
                setAttendanceNotice({ type: "warning", text: (error as Error).message || "Failed to mark attendance." });
              }
              return;
            }
            // Singapore: check if scanned code is a bin location
            if (isSingaporeSession && binOptions.some((b) => b.toLowerCase() === lowerCode)) {
              const matchedBin = binOptions.find((b) => b.toLowerCase() === lowerCode) ?? trimmedCode;
              setScannedBin(matchedBin);
              setQuery("");
              setActiveItemId(null);
              return;
            }
            const matches = scanMatchPool.filter(
              (item) => item.code.toLowerCase() === lowerCode || (item.batch && item.batch.toLowerCase() === lowerCode)
            );
            if (matches.length === 1) {
              setActiveItemId(matches[0].id);
            } else if (matches.length > 1) {
              setQuery(trimmedCode);
            } else {
              setScanNotFound(trimmedCode);
            }
          }}
          onClose={() => setCameraOpen(false)}
        />
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
              {multiScanNotice ? (
                <BannerModal type="warning" message={multiScanNotice} onClose={() => setMultiScanNotice("")} />
              ) : null}
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
        <form
          className="panel"
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
                setQuery("");
              } catch (error) {
                setNewItemError((error as Error).message || "Failed to submit new item.");
              }
            }}
          >
            <button type="button" className="cv-back-btn" onClick={() => { setNewItemOpen(false); setNewItemError(""); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
              <span>Back to search</span>
            </button>
            <h2>Add New Item</h2>
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
                  <input
                    className="cv-field-input"
                    list="uom-options"
                    value={newItemUom}
                    onChange={(event) => setNewItemUom(event.target.value)}
                    placeholder="Select or type..."
                  />
                  <datalist id="uom-options">
                    <option value="unit" />
                    <option value="pcs" />
                    <option value="vial" />
                    <option value="bottle" />
                    <option value="pack" />
                    <option value="box" />
                    <option value="kit" />
                  </datalist>
                </label>
                <label>
                  Serial / Batch No.
                  <input className="cv-field-input" value={newItemBatch} onChange={(event) => setNewItemBatch(event.target.value)} />
                </label>
                <div>
                  <span className="cv-field-label">Bin Location</span>
                  <div className="cv-bin-input-row">
                    <select className="cv-field-input cv-bin-search-input" value={newItemWarehouse} onChange={(event) => setNewItemWarehouse(event.target.value)}>
                      <option value="">Select bin...</option>
                      {binOptions.map((wh) => (
                        <option key={wh} value={wh}>{wh}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="cv-bin-scan-btn"
                      title="Scan bin barcode"
                      onClick={() => setNewItemBinScanOpen(true)}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="3" width="4" height="4" rx="0.5" /><rect x="17" y="3" width="4" height="4" rx="0.5" /><rect x="3" y="17" width="4" height="4" rx="0.5" />
                        <line x1="7" y1="5" x2="17" y2="5" /><line x1="7" y1="19" x2="12" y2="19" /><line x1="19" y1="7" x2="19" y2="17" /><line x1="5" y1="7" x2="5" y2="17" /><line x1="12" y1="12" x2="12" y2="19" /><line x1="12" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <label>
                  Counted Qty
                  <QuantityField value={newItemQty} onChange={setNewItemQty} hideButtons />
                </label>
                <label>
                  Damaged Qty
                  <QuantityField value={newItemDamagedQty} onChange={setNewItemDamagedQty} hideButtons />
                </label>
                <label>
                  Expired Qty
                  <QuantityField value={newItemExpiredQty} onChange={setNewItemExpiredQty} hideButtons />
                </label>
                <label className="count-form-full">
                  Remark
                  <textarea className="cv-textarea" rows={2} value={newItemRemark} onChange={(event) => setNewItemRemark(event.target.value)} />
                </label>
                <div className="count-form-full">
                  <div className="cv-photo-label">Photos (at least one required)</div>
                  <input
                    ref={newItemPhotoRef}
                    id="new-item-photo-input"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: "none" }}
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      if (newItemPhotoRef.current) newItemPhotoRef.current.value = "";
                      try {
                        const url = await uploadPhoto(file);
                        setNewItemPhotos((prev) => [...prev, url]);
                      } catch (err) {
                        setNewItemError((err as Error).message || "Failed to upload photo.");
                      }
                    }}
                  />
                  <label htmlFor="new-item-photo-input" className="cv-photo-btn" style={{ cursor: "pointer" }} title={newItemPhotos.length === 0 ? "Take photo" : `${newItemPhotos.length} photo(s)`}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    {newItemPhotos.length > 0 ? <span className="cv-photo-count">{newItemPhotos.length}</span> : null}
                  </label>
                  {newItemPhotos.length > 0 ? (
                    <div className="cv-photo-thumbs">
                      {newItemPhotos.map((src, i) => (
                        <div key={i} className="cv-photo-thumb-wrap">
                          <img src={src} alt={`Photo ${i + 1}`} className="cv-photo-thumb" />
                          <button
                            type="button"
                            className="cv-photo-thumb-remove"
                            onClick={() => setNewItemPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                          >×</button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              {newItemError ? (
                <BannerModal type="warning" message={newItemError} onClose={() => setNewItemError("")} />
              ) : null}
              <button type="submit" className="primary-btn" disabled={createNewItem.isPending}>
                {createNewItem.isPending ? "Submitting..." : "Submit New Item"}
              </button>
            </div>
        </form>
      ) : null}

      {newItemBinScanOpen ? (
        <CameraScanner
          onDetected={(code) => {
            setNewItemBinScanOpen(false);
            setNewItemWarehouse(code.trim());
          }}
          onClose={() => setNewItemBinScanOpen(false)}
        />
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
