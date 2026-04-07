import { useEffect, useMemo, useState } from "react";
import { useCountHistoryQuery, useSessionsQuery } from "../hooks/useAdminData";
import { useIdentity } from "../app/IdentityContext";
import { useSubmitCountMutation } from "../hooks/useWarehouseData";
import { QuantityField } from "../components/ui/QuantityField";

const COUNT_SESSION_STORAGE_KEY = "stp_count_sess";

export function CountHistoryPage() {
  const { identity } = useIdentity();
  const submitCount = useSubmitCountMutation();
  const { data: sessions = [] } = useSessionsQuery();
  const [sessionId, setSessionId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<number | null>(null);
  const { data: rows = [], isLoading } = useCountHistoryQuery({
    sessionId: sessionId || undefined
  });

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
        const [sessionId, sessionName] = groupKey.split("::");
        return (
          <section key={groupKey} className="panel nested-panel">
            <h3>
              {sessionName} ({sessionId})
            </h3>
            <div className="card">
              <table className="legacy-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Submitted By</th>
                    <th>Warehouse</th>
                    <th>Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {groupRows.map((row) => (
                    <tr key={row.id}>
                      <td>{new Date(row.countedAt).toLocaleString()}</td>
                      <td>
                        {row.itemCode} - {row.itemName}
                      </td>
                      <td>
                        {editingId === row.id ? (
                          <div className="ch-edit-qty-row">
                            <QuantityField value={editQty} onChange={setEditQty} />
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              disabled={editQty === null || submitCount.isPending}
                              onClick={async () => {
                                if (!row.itemId || editQty === null) return;
                                await submitCount.mutateAsync({
                                  itemId: row.itemId,
                                  qty: editQty,
                                  submittedBy: identity?.name || "Counter",
                                  remark: "Edited from count history"
                                });
                                setEditingId(null);
                                setEditQty(null);
                              }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => { setEditingId(null); setEditQty(null); }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="ch-qty-cell">
                            <span>{row.qty}</span>
                            {row.itemId ? (
                              <button
                                type="button"
                                className="ch-edit-btn"
                                onClick={() => { setEditingId(row.id); setEditQty(row.qty); }}
                                title="Edit quantity"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td>{row.submittedBy}</td>
                      <td>{row.warehouse ?? "-"}</td>
                      <td>{row.remark ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </section>
  );
}
