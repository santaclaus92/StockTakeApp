import type { Session } from "../../types/domain";
import { formatLegacyDateRange } from "../../utils/legacyDate";

interface SessionHeaderProps {
  session: Session;
  visibilityUpdating?: boolean;
  endingSession?: boolean;
  loadingRecountItems?: boolean;
  hasLinkedRecount?: boolean;
  parentSessionName?: string | null;
  linkedRecountName?: string | null;
  onToggleVisibility: () => void;
  onOpenDashboard: () => void;
  onEndSession: () => void;
  onLoadRecountItems?: () => void;
}

export function SessionHeader({
  session,
  visibilityUpdating = false,
  endingSession = false,
  loadingRecountItems = false,
  hasLinkedRecount = false,
  parentSessionName = null,
  linkedRecountName = null,
  onToggleVisibility,
  onOpenDashboard,
  onEndSession,
  onLoadRecountItems
}: SessionHeaderProps) {
  const statusClass = session.status === "Active" ? "status-active" : session.status === "Closed" ? "status-closed" : "status-pending";
  const visibilityLabel = session.userVisible ? "Visible to users" : "Hidden from users";
  const visibilityClass = session.userVisible ? "btn btn-sm btn-success" : "btn btn-sm sess-visibility-hidden";
  const disableVisibility = visibilityUpdating || session.status === "Closed";
  const rangeText = formatLegacyDateRange(session.startDate, session.endDate);

  return (
    <section className="sess-hdr">
      <div className="sess-hdr-top">
        <div className="sess-title-wrap">
          <div className="sess-title-row">
            <div className="sess-title">{session.name}</div>
            {session.isRecount ? <span className="badge b-purple">Recount</span> : null}
          </div>
          <div className="sess-id">
            <span className="sess-id-part">{session.type}</span>
            <span className="sess-id-sep" aria-hidden="true">
              {"\u00B7"}
            </span>
            <span className="sess-id-part">{session.entity}</span>
            <span className="sess-id-sep" aria-hidden="true">
              {"\u00B7"}
            </span>
            <span className="sess-id-part">{rangeText}</span>
          </div>
        </div>
        <div className="sess-actions">
          <button type="button" className={visibilityClass} onClick={onToggleVisibility} disabled={disableVisibility}>
            {visibilityUpdating ? "Updating..." : visibilityLabel}
          </button>
          <button type="button" aria-label="Open TV Dashboard" className="btn btn-success btn-sm" onClick={onOpenDashboard}>
            Dashboard
          </button>
          {session.status === "Active" ? (
            <button type="button" className="btn btn-danger btn-sm" onClick={onEndSession} disabled={endingSession}>
              {endingSession ? "Ending..." : "End session"}
            </button>
          ) : null}
          {!session.isRecount && session.status === "Closed" && hasLinkedRecount && onLoadRecountItems ? (
            <button type="button" className="btn btn-sm" onClick={onLoadRecountItems} disabled={loadingRecountItems}>
              {loadingRecountItems ? "Loading..." : "Load recount items"}
            </button>
          ) : null}
        </div>
      </div>
      <div className="sess-meta-row">
        <div className="meta-chip">
          <div className="meta-lbl">Status</div>
          <div className={`meta-val meta-val-status ${statusClass}`}>
            {"\u25CF "}
            {session.status}
          </div>
        </div>
        <div className="meta-chip">
          <div className="meta-lbl">Progress</div>
          <div className="meta-val">{session.progress}%</div>
        </div>
        <div className="meta-chip">
          <div className="meta-lbl">Country</div>
          <div className="meta-val">{session.country}</div>
        </div>
        {session.isRecount && session.parentId ? (
          <div className="meta-chip">
            <div className="meta-lbl">Parent Session</div>
            <div className="meta-val">{parentSessionName ?? session.parentId}</div>
          </div>
        ) : null}
      </div>
      {session.isRecount && parentSessionName ? (
        <div className="sess-linked-notice">
          This session is linked to <strong>{parentSessionName}</strong>
        </div>
      ) : null}
      {!session.isRecount && linkedRecountName ? (
        <div className="sess-linked-notice">
          This session is linked to <strong>{linkedRecountName}</strong>
        </div>
      ) : null}
    </section>
  );
}
