import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useCountHistoryQuery, useCreateAdjustmentMutation, useMyAdjustmentsQuery, useSessionsQuery } from "../hooks/useAdminData";
import { useIdentity } from "../app/IdentityContext";
import { useBinsQuery } from "../hooks/useWarehouseData";

const COUNT_SESSION_STORAGE_KEY = "stp_count_sess";

export function CountHistoryPage() {
  const { identity } = useIdentity();
  const createAdjustment = useCreateAdjustmentMutation();
  const { data: sessions = [] } = useSessionsQuery();
  const [sessionId, setSessionId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<string>("");
  const [editBin, setEditBin] = useState<string>("");
  const [binDropdownOpen, setBinDropdownOpen] = useState(false);
  const [binSearch, setBinSearch] = useState("");
  const binRef = useRef<HTMLDivElement>(null);

  const { data: rows = [], isLoading } = useCountHistoryQuery({
    sessionId: sessionId || undefined
  });
  const { data: fetchedBins = [] } = useBinsQuery(Boolean(sessionId));
  const { data: myAdjustments = [] } = useMyAdjustmentsQuery(sessionId || undefined);

  useEffect(() => {
    if (sessionId) return;
    const saved = localStorage.getItem(COUNT_SESSION_STORAGE_KEY);
    if (!saved) return;
    const isKnown = sessions.some((session) => session.id === saved);
    if (!isKnown) {
      localStorage.removeItem(COUNT_SESSION_STORAGE_KEY);
      return;
    }
    setSessionId(saved);
  }, [sessionId, sessions]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (binRef.current && !binRef.current.contains(e.target as Node)) {
        setBinDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Map item_id -> latest adjustment status for quick lookup
  const adjustmentByItemId = useMemo(() => {
    const map = new Map<string, { status: string; id: string }>();
    [...myAdjustments].reverse().forEach((adj) => {
      if (adj.itemId) map.set(adj.itemId, { status: adj.status, id: adj.id });
    });
    return map;
  }, [myAdjustments]);

  const filteredBins = useMemo(
    () => fetchedBins.filter((b) => !binSearch || b.toLowerCase().includes(binSearch.toLowerCase())),
    [fetchedBins, binSearch]
  );

  const groupedBySession = useMemo(() => {
    const grouped = new Map<string, typeof rows>();
    rows.forEach((row) => {
      const key = `${row.sessionId}::${row.sessionName}`;
      grouped.set(key, [...(grouped.get(key) ?? []), row]);
    });
    return Array.from(grouped.entries());
  }, [rows]);

  const sessionOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{ id: string; name: string }> = [];
    sessions.forEach((session) => {
      seen.add(session.id);
      options.push({ id: session.id, name: session.name });
    });
    groupedBySession.forEach(([groupKey]) => {
      const [id, name] = groupKey.split("::");
      if (!id || seen.has(id)) return;
      seen.add(id);
      options.push({ id, name: name || id });
    });
    return options.sort((a, b) => a.name.localeCompare(b.name));
  }, [groupedBySession, sessions]);

  const startEdit = (row: (typeof rows)[number]) => {
    setEditingId(row.id);
    setEditQty(String(row.qty));
    setEditBin(row.binLocation ?? "");
    setBinSearch("");
    setBinDropdownOpen(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditQty("");
    setEditBin("");
    setBinSearch("");
    setBinDropdownOpen(false);
  };

  const saveEdit = async (row: (typeof rows)[number]) => {
    if (!row.itemId || !sessionId) return;
    const qty = parseInt(editQty, 10);
    if (!Number.isFinite(qty) || qty < 0) return;
    await createAdjustment.mutateAsync({
      sessionId,
      itemId: row.itemId,
      newQty: qty,
      newBinLocation: editBin || undefined,
      submittedBy: identity?.name || "Counter",
      remark: "Edit request from count history"
    });
    cancelEdit();
  };

  return (
    <section className="panel">
      <div className="tab-header-row">
        <div>
          <h2>My Count History</h2>
          <p>Review audit entries by session.</p>
        </div>
      </div>

      <div className="inline-form">
        <label>
          Session
          <select
            value={sessionId}
            onChange={(event) => {
              setSessionId(event.target.value);
              if (event.target.value) {
                localStorage.setItem(COUNT_SESSION_STORAGE_KEY, event.target.value);
              } else {
                localStorage.removeItem(COUNT_SESSION_STORAGE_KEY);
              }
            }}
          >
            <option value="">All sessions</option>
            {sessionOptions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading ? <p>Loading history...</p> : null}
      {!isLoading && groupedBySession.length === 0 ? <p className="muted">No count history found for this filter.</p> : null}

      {groupedBySession.map(([groupKey, groupRows]) => {
        const [grpSessionId, sessionName] = groupKey.split("::");
        return (
          <section key={groupKey} className="panel nested-panel">
            <h3>
              {sessionName} ({grpSessionId})
            </h3>
            <div className="card">
              <table className="legacy-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Bin Location</th>
                    <th>Submitted By</th>
                    <th>Approval</th>
                    <th>Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {groupRows.map((row) => {
                    const isEditing = editingId === row.id;
                    const adjStatus = row.itemId ? adjustmentByItemId.get(row.itemId) : undefined;
                    return (
                      <Fragment key={row.id}>
                        <tr>
                          <td>{new Date(row.countedAt).toLocaleString()}</td>
                          <td>
                            {row.itemCode} - {row.itemName}
                          </td>
                          <td>
                            <div className="ch-qty-cell">
                              <span>{row.qty}</span>
                              {row.itemId && !isEditing ? (
                                <button
                                  type="button"
                                  className="ch-edit-btn"
                                  onClick={() => startEdit(row)}
                                  title="Request edit"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                </button>
                              ) : null}
                            </div>
                          </td>
                          <td>{row.binLocation ?? "-"}</td>
                          <td>{row.submittedBy}</td>
                          <td>
                            {adjStatus ? (
                              <span className={`ch-approval-badge ch-approval-${adjStatus.status.toLowerCase()}`}>
                                {adjStatus.status}
                              </span>
                            ) : "-"}
                          </td>
                          <td>{row.remark ?? "-"}</td>
                        </tr>
                        {isEditing ? (
                          <tr key={`${row.id}-edit`} className="ch-edit-row">
                            <td colSpan={7}>
                              <div className="ch-edit-panel">
                                <div className="ch-edit-fields">
                                  <label className="ch-edit-field">
                                    <span>New Qty</span>
                                    <input
                                      type="number"
                                      className="ch-qty-input"
                                      value={editQty}
                                      min={0}
                                      onChange={(e) => setEditQty(e.target.value)}
                                    />
                                  </label>
                                  <div className="ch-edit-field" ref={binRef}>
                                    <span>Bin Location</span>
                                    <div className="cv-bin-combobox">
                                      <div className="cv-bin-input-row">
                                        <input
                                          className="cv-bin-search-input"
                                          type="text"
                                          placeholder={editBin || "Search bin..."}
                                          value={binSearch}
                                          onChange={(e) => { setBinSearch(e.target.value); setBinDropdownOpen(true); }}
                                          onFocus={() => setBinDropdownOpen(true)}
                                          onBlur={() => setTimeout(() => setBinDropdownOpen(false), 150)}
                                        />
                                        <button
                                          type="button"
                                          className="cv-bin-chevron"
                                          onMouseDown={(e) => { e.preventDefault(); setBinDropdownOpen((v) => !v); }}
                                        >
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: binDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                                            <polyline points="6 9 12 15 18 9" />
                                          </svg>
                                        </button>
                                      </div>
                                      {editBin ? <div className="ch-bin-selected">{editBin}</div> : null}
                                      {binDropdownOpen ? (
                                        <div className="cv-bin-dropdown">
                                          {filteredBins.length === 0 ? (
                                            <div className="cv-bin-empty">No bins found</div>
                                          ) : (
                                            filteredBins.map((b) => (
                                              <div
                                                key={b}
                                                className={`cv-bin-option ${editBin === b ? "selected" : ""}`}
                                                onMouseDown={(e) => { e.preventDefault(); setEditBin(b); setBinSearch(""); setBinDropdownOpen(false); }}
                                              >
                                                <span>{b}</span>
                                                {editBin === b ? (
                                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12" />
                                                  </svg>
                                                ) : null}
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                                <div className="ch-edit-actions">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    disabled={editQty === "" || createAdjustment.isPending}
                                    onClick={() => void saveEdit(row)}
                                  >
                                    {createAdjustment.isPending ? "Saving..." : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm"
                                    onClick={cancelEdit}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </section>
  );
}
