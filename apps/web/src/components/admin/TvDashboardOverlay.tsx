import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useAttendanceQuery, useDashboardDetailsQuery, useDashboardQuery, usePairsQuery } from "../../hooks/useAdminData";
import type { AttendanceRecord } from "../../types/domain";

interface TvDashboardOverlayProps {
  open: boolean;
  sessionName: string;
  sessionId: string;
  onClose: () => void;
}

function completionColor(pct: number): string {
  if (pct === 100) return "#4ade80";
  if (pct >= 60) return "#60a5fa";
  if (pct >= 30) return "#f59e0b";
  return "#f87171";
}

function formatTvTime(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function toLatestAttendanceTimestamp(attendee?: AttendanceRecord): number {
  if (!attendee) return 0;
  const marks = [attendee.checkIn, attendee.lunchOut, attendee.lunchIn, attendee.checkOut]
    .map((value) => (value ? Date.parse(value) : Number.NaN))
    .filter((value) => Number.isFinite(value));
  if (marks.length === 0) return 0;
  return Math.max(...marks);
}

function getAttendanceTimes(attendee?: AttendanceRecord): string[] {
  return [attendee?.checkIn, attendee?.lunchOut, attendee?.lunchIn, attendee?.checkOut].map(formatTvTime);
}

export function TvDashboardOverlay({ open, sessionName, sessionId, onClose }: TvDashboardOverlayProps) {
  const dashboard = useDashboardQuery(sessionId);
  const details = useDashboardDetailsQuery(sessionId);
  const attendance = useAttendanceQuery(sessionId);
  const pairs = usePairsQuery(sessionId);

  const [qrTick, setQrTick] = useState(Date.now());
  const [qrExpiresAt, setQrExpiresAt] = useState(Date.now() + 60_000);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrExpanded, setQrExpanded] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => {
      void dashboard.refetch();
      void details.refetch();
      void attendance.refetch();
      void pairs.refetch();
    }, 10_000);
    return () => clearInterval(timer);
  }, [attendance, dashboard, details, open, pairs]);

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setQrTick(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQrExpanded(false);
      return;
    }
    if (qrTick < qrExpiresAt) return;
    setQrExpiresAt(Date.now() + 60_000);
  }, [open, qrExpiresAt, qrTick]);

  const secondsLeft = Math.max(0, Math.ceil((qrExpiresAt - qrTick) / 1000));
  const qrToken = useMemo(() => `att:${sessionId}:${Math.floor(qrExpiresAt / 60_000)}`, [qrExpiresAt, sessionId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void QRCode.toDataURL(qrToken, {
      width: 220,
      margin: 1,
      color: { dark: "#2C3E50", light: "#ffffff" }
    })
      .then((next) => {
        if (!cancelled) setQrDataUrl(next);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });

    return () => {
      cancelled = true;
    };
  }, [open, qrToken]);

  if (!open) return null;

  const totalItems = dashboard.data?.totalItems ?? 0;
  const countedItems = dashboard.data?.countedItems ?? 0;
  const pendingItems = dashboard.data?.pendingItems ?? 0;
  const newItems = dashboard.data?.newItems ?? 0;
  const completionPct = totalItems > 0 ? Math.round((countedItems / totalItems) * 100) : 0;
  const ringCirc = 389.6;
  const ringFill = ((completionPct / 100) * ringCirc).toFixed(1);
  const ringColor = completionColor(completionPct);
  const byGroup = details.data?.byGroup ?? [];
  const byWarehouse = details.data?.byWarehouse ?? [];
  const attendees = attendance.data ?? [];
  const present = attendees.filter((row) => row.attended).length;
  const totalAttendees = attendees.length;

  const attendeeByName = new Map(attendees.map((row) => [normalizeName(row.name), row]));

  const sortedPairs = (pairs.data ?? [])
    .map((pair, index) => {
      const members = [pair.counter, pair.checker, pair.counter2]
        .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
        .map((name) => {
          const attendee = attendeeByName.get(normalizeName(name));
          return {
            name,
            attendee,
            latestTimestamp: toLatestAttendanceTimestamp(attendee)
          };
        });

      const latestTimestamp = members.reduce((max, member) => Math.max(max, member.latestTimestamp), 0);
      return {
        id: pair.id,
        label: `Pair ${index + 1}`,
        members,
        latestTimestamp
      };
    })
    .sort((a, b) => b.latestTimestamp - a.latestTimestamp || a.label.localeCompare(b.label));

  return (
    <div className="tv-overlay" role="dialog" aria-modal="true" aria-label="TV Dashboard">
      <section className="tv-shell">
        <header className="tv-head-grid">
          <div className="tv-brand-block">
            <div className="tv-brand-name">MediCount</div>
            <div className="tv-brand-tagline">Everyone Counts</div>
          </div>
          <div className="tv-session-block">
            <div className="tv-session-meta">{sessionId}</div>
            <div className="tv-session-name">{sessionName}</div>
          </div>
          <div className="tv-close-wrap">
            <button type="button" onClick={onClose} className="tv-close-btn">
              Close
            </button>
          </div>
        </header>

        <div className="tv-main-grid">
          <aside className="tv-left-col">
            <section className="tv-ring-card">
              <div className="tv-ring-wrap">
                <svg width="152" height="152" viewBox="0 0 152 152">
                  <circle cx="76" cy="76" r="62" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="11" />
                  <circle
                    cx="76"
                    cy="76"
                    r="62"
                    fill="none"
                    stroke={ringColor}
                    strokeWidth="11"
                    strokeLinecap="round"
                    strokeDasharray={`${ringFill} ${ringCirc}`}
                    transform="rotate(-90 76 76)"
                    style={{ transition: "stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)" }}
                  />
                </svg>
                <div className="tv-ring-center">
                  <div className="tv-ring-value">{completionPct}%</div>
                  <div className="tv-ring-sub">complete</div>
                </div>
              </div>
              <div className="tv-ring-label">Overall Progress</div>
            </section>

            <section className="tv-token-card">
              <div className="tv-token-label">Scan to Join</div>
              <div className="tv-qr-wrap">
                {qrDataUrl ? (
                  <button
                    type="button"
                    className="tv-qr-btn"
                    aria-label="Expand attendance QR"
                    onClick={() => setQrExpanded(true)}
                  >
                    <img className="tv-qr-img" src={qrDataUrl} alt={`Attendance QR for ${sessionId}`} />
                  </button>
                ) : (
                  <code className="tv-token-code">{qrToken}</code>
                )}
              </div>
              <div className="tv-token-sub">
                Refreshes in {secondsLeft}s
              </div>
            </section>
          </aside>

          <section className="tv-center-col">
            <div className="tv-kpi-grid">
              <article className="tv-kpi-card tv-kpi-blue">
                <div className="tv-kpi-label">Total SKUs</div>
                <div className="tv-kpi-value">{totalItems}</div>
              </article>
              <article className="tv-kpi-card tv-kpi-green">
                <div className="tv-kpi-label">Counted</div>
                <div className="tv-kpi-value">{countedItems}</div>
              </article>
              <article className="tv-kpi-card tv-kpi-amber">
                <div className="tv-kpi-label">Pending</div>
                <div className="tv-kpi-value">{pendingItems}</div>
              </article>
              <article className="tv-kpi-card tv-kpi-purple">
                <div className="tv-kpi-label">New Items</div>
                <div className="tv-kpi-value">{newItems}</div>
              </article>
            </div>

            <div className="tv-breakdown-grid">
              <section className="tv-panel">
                <div className="tv-panel-head">By Item Group</div>
                <div className="tv-panel-body">
                  <table className="tv-table">
                    <thead>
                      <tr>
                        <th>Group</th>
                        <th>Counted</th>
                        <th>Total</th>
                        <th>Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byGroup.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="tv-empty-row">
                            No data
                          </td>
                        </tr>
                      ) : (
                        byGroup.map((row) => {
                          const pct = row.total > 0 ? Math.round((row.counted / row.total) * 100) : 0;
                          const progressColor = completionColor(pct);
                          return (
                            <tr key={row.key}>
                              <td>{row.key || "Unassigned"}</td>
                              <td className="tv-num">{row.counted}</td>
                              <td className="tv-num">{row.total}</td>
                              <td>
                                <div className="tv-progress">
                                  <div className="tv-progress-bar">
                                    <div className="tv-progress-fill" style={{ width: `${pct}%`, background: progressColor }} />
                                  </div>
                                  <span className="tv-progress-pct" style={{ color: progressColor }}>
                                    {pct}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="tv-panel">
                <div className="tv-panel-head">By Warehouse</div>
                <div className="tv-panel-body">
                  <table className="tv-table">
                    <thead>
                      <tr>
                        <th>Warehouse</th>
                        <th>Counted</th>
                        <th>Total</th>
                        <th>Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byWarehouse.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="tv-empty-row">
                            No data
                          </td>
                        </tr>
                      ) : (
                        byWarehouse.map((row) => {
                          const pct = row.total > 0 ? Math.round((row.counted / row.total) * 100) : 0;
                          const progressColor = completionColor(pct);
                          return (
                            <tr key={row.key}>
                              <td>{row.key || "Unassigned"}</td>
                              <td className="tv-num">{row.counted}</td>
                              <td className="tv-num">{row.total}</td>
                              <td>
                                <div className="tv-progress">
                                  <div className="tv-progress-bar">
                                    <div className="tv-progress-fill" style={{ width: `${pct}%`, background: progressColor }} />
                                  </div>
                                  <span className="tv-progress-pct" style={{ color: progressColor }}>
                                    {pct}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </section>

          <aside className="tv-att-col">
            <section className="tv-panel tv-att-panel">
              <div className="tv-panel-head tv-att-head">
                <span>Attendance</span>
                <span className="tv-att-count">
                  {present}/{totalAttendees}
                </span>
              </div>
              <div className="tv-att-list">
                {sortedPairs.length === 0 ? (
                  <div className="tv-att-empty">No pair attendance yet</div>
                ) : (
                  sortedPairs.map((pair) => (
                    <article key={pair.id} className="tv-pair-card">
                      <div className="tv-pair-members">
                        {pair.members.map((member) => (
                          <div key={`${pair.id}-${member.name}`} className="tv-member-line">
                            <span
                              className={`tv-member-dot ${member.attendee?.attended ? "present" : "absent"}`}
                              aria-hidden="true"
                            />
                            <span className="tv-member-name">{member.name}</span>
                            <div className="tv-timing-pills">
                              {getAttendanceTimes(member.attendee).map((time, i) => (
                                <span key={i} className="tv-timing-pill">{time}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>
      </section>

      {qrExpanded ? (
        <div className="tv-qr-lightbox" role="dialog" aria-modal="true" aria-label="Expanded attendance QR" onClick={() => setQrExpanded(false)}>
          <div className="tv-qr-lightbox-card" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="tv-qr-lightbox-close" onClick={() => setQrExpanded(false)}>
              Close
            </button>
            {qrDataUrl ? <img className="tv-qr-lightbox-img" src={qrDataUrl} alt={`Expanded attendance QR for ${sessionId}`} /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
