import { useMemo, useState } from "react";
import { useDashboardDetailsQuery, useDashboardQuery, useItemsQuery } from "../../../hooks/useAdminData";
import type { DashboardBreakdownRow, ItemMasterItem } from "../../../types/domain";

interface DashboardTabProps {
  sessionId: string;
}

interface DrilldownState {
  label: string;
  type: "group" | "warehouse";
  row: DashboardBreakdownRow;
}

function completionColor(pct: number): string {
  if (pct === 100) return "#4ade80";
  if (pct >= 60) return "#60a5fa";
  if (pct >= 30) return "#f59e0b";
  return "#f87171";
}

export function DashboardTab({ sessionId }: DashboardTabProps) {
  const { data, isLoading } = useDashboardQuery(sessionId);
  const { data: details } = useDashboardDetailsQuery(sessionId);
  const { data: items = [] } = useItemsQuery(sessionId);
  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null);
  const [drilldownFilter, setDrilldownFilter] = useState<"all" | "Variance" | "Pending" | "Matched">("all");

  const completionPct = useMemo(() => {
    if (!data || data.totalItems === 0) return 0;
    return Math.round((data.countedItems / data.totalItems) * 100);
  }, [data]);

  const ringCirc = 207.3;
  const ringFill = ((completionPct / 100) * ringCirc).toFixed(1);
  const ringColor = completionColor(completionPct);

  const drilldownItems = useMemo(() => {
    if (!drilldown) return [];
    return items.filter((item) => {
      if (item.dropped) return false;
      if (drilldown.type === "group") {
        return (item.group || "Ungrouped") === drilldown.label;
      }
      return (item.whCode?.trim() || item.warehouse || "-") === drilldown.label;
    });
  }, [drilldown, items]);

  if (isLoading || !data) return <p>Loading dashboard...</p>;

  const renderRows = (rows: DashboardBreakdownRow[], type: "group" | "warehouse") =>
    rows.map((row) => {
      const pct = row.total > 0 ? Math.round((row.counted / row.total) * 100) : 0;
      const barColor = completionColor(pct);

      return (
        <tr key={`${type}-${row.key}`} className="db-breakdown-row" onClick={() => setDrilldown({ label: row.key, type, row })} title="Click to view items">
          <td className="db-cell-key">{row.key || "Unassigned"}</td>
          <td className="db-cell-num">{row.total}</td>
          <td className="db-cell-num">{row.counted}</td>
          <td>
            <div className="db-mini-wrap">
              <div className="db-mini-bar">
                <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 3, transition: "width 0.5s ease" }} />
              </div>
              <span className="db-mini-pct" style={{ color: barColor }}>
                {pct}%
              </span>
            </div>
          </td>
        </tr>
      );
    });

  return (
    <section className="panel">
      <div className="db-kpi-grid">
        <div className="db-kpi-card db-kpi-ring">
          <div className="db-ring-wrap">
            <svg width="84" height="84" viewBox="0 0 84 84">
              <circle cx="42" cy="42" r="33" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7" />
              <circle
                cx="42"
                cy="42"
                r="33"
                fill="none"
                stroke={ringColor}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${ringFill} ${ringCirc}`}
                transform="rotate(-90 42 42)"
                style={{ transition: "stroke-dasharray 0.7s cubic-bezier(0.4,0,0.2,1)" }}
              />
            </svg>
            <div className="db-ring-center">
              <div className="db-ring-value">{completionPct}%</div>
              <div className="db-ring-small">done</div>
            </div>
          </div>
          <div className="db-ring-caption">Completion</div>
        </div>

        <div className="db-kpi-card db-kpi-blue">
          <div className="db-kpi-icon">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </div>
          <div className="db-kpi-lbl">Total Items</div>
          <div className="db-kpi-val">{data.totalItems}</div>
        </div>

        <div className="db-kpi-card db-kpi-green">
          <div className="db-kpi-icon">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="db-kpi-lbl">Counted</div>
          <div className="db-kpi-val">
            {data.countedItems} / {data.totalItems}
          </div>
        </div>

        <div className="db-kpi-card db-kpi-amber">
          <div className="db-kpi-icon">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2">
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="db-kpi-lbl">Pending</div>
          <div className="db-kpi-val">{data.pendingItems}</div>
        </div>

        <div className="db-kpi-card db-kpi-purple">
          <div className="db-kpi-icon">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div className="db-kpi-lbl">New Items</div>
          <div className="db-kpi-val">{data.newItems}</div>
        </div>
      </div>

      <div className="db-table-grid">
        <div className="card db-table-card db-table-card-flat">
          <div className="db-table-head">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            By Item Group
            <span className="db-table-hint">click row to view items</span>
          </div>
          <div className="db-table-scroll">
            <table className="legacy-table compact">
              <thead>
                <tr>
                  <th>Group</th>
                  <th className="db-col-num db-col-total">Total</th>
                  <th className="db-col-num db-col-counted">Counted</th>
                  <th className="db-col-progress">Progress</th>
                </tr>
              </thead>
              <tbody>{renderRows(details?.byGroup ?? [], "group")}</tbody>
            </table>
          </div>
        </div>

        <div className="card db-table-card db-table-card-flat">
          <div className="db-table-head">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            By Warehouse
            <span className="db-table-hint">click row to view items</span>
          </div>
          <div className="db-table-scroll">
            <table className="legacy-table compact">
              <thead>
                <tr>
                  <th>Warehouse</th>
                  <th className="db-col-num db-col-total">Total</th>
                  <th className="db-col-num db-col-counted">Counted</th>
                  <th className="db-col-progress">Progress</th>
                </tr>
              </thead>
              <tbody>{renderRows(details?.byWarehouse ?? [], "warehouse")}</tbody>
            </table>
          </div>
        </div>
      </div>

      {drilldown ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Dashboard Drilldown">
          <section className="modal modal-wide">
            <header>
              <h2>
                {drilldown.type === "group" ? "Item Group" : "Warehouse"} - {drilldown.label}
              </h2>
              <button type="button" onClick={() => setDrilldown(null)} className="ghost-btn">
                X
              </button>
            </header>
            <div className="inline-summary">
              <span>Total: {drilldown.row.total}</span>
              <span>Counted: {drilldown.row.counted}</span>
              <span>Pending: {drilldown.row.pending}</span>
              <span>Variance: {drilldown.row.variance}</span>
            </div>
            <div className="db-filter-btns">
              {(["all", "Variance", "Pending", "Matched"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`db-filter-btn${drilldownFilter === f ? " active" : ""} db-filter-btn-${f.toLowerCase()}`}
                  onClick={() => setDrilldownFilter(f)}
                >
                  {f === "all" ? "All" : f}
                  {f !== "all" ? ` (${drilldownItems.filter((i) => i.status === f).length})` : ` (${drilldownItems.length})`}
                </button>
              ))}
            </div>
            <table className="legacy-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Warehouse</th>
                  <th>SAP Qty</th>
                  <th>Count Qty</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {drilldownItems.filter((i) => drilldownFilter === "all" || i.status === drilldownFilter).map((item: ItemMasterItem) => (
                  <tr key={item.id}>
                    <td>{item.code}</td>
                    <td>{item.name}</td>
                    <td>{item.whCode || item.warehouse || "-"}</td>
                    <td>{item.sapQty}</td>
                    <td>{item.countQty ?? "-"}</td>
                    <td>{item.status}</td>
                  </tr>
                ))}
                {drilldownItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="db-empty-cell">
                      No items
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}
    </section>
  );
}
