import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SessionHeader } from "../components/admin/SessionHeader";
import { TvDashboardOverlay } from "../components/admin/TvDashboardOverlay";
import { ApprovalTab } from "../components/admin/tabs/ApprovalTab";
import { AttendanceTab } from "../components/admin/tabs/AttendanceTab";
import { AuditTrailTab } from "../components/admin/tabs/AuditTrailTab";
import { DashboardTab } from "../components/admin/tabs/DashboardTab";
import { NewItemGalleryTab } from "../components/admin/tabs/NewItemGalleryTab";
import { PairAssignmentTab } from "../components/admin/tabs/PairAssignmentTab";
import { StockCountTab } from "../components/admin/tabs/StockCountTab";
import {
  useApprovalsQuery,
  useEndSessionMutation,
  useLoadRecountItemsMutation,
  useSessionQuery,
  useSessionsQuery,
  useToggleSessionVisibilityMutation,
  useToggleStrictRolesMutation
} from "../hooks/useAdminData";

type SessionTabKey = "pairs" | "attendance" | "items" | "dashboard" | "audit" | "gallery" | "approval";

const TAB_CONFIG: { key: SessionTabKey; label: string }[] = [
  { key: "pairs", label: "Pair Assignment" },
  { key: "attendance", label: "Attendance" },
  { key: "items", label: "Item Master" },
  { key: "dashboard", label: "Dashboard" },
  { key: "gallery", label: "New Item Gallery" },
  { key: "audit", label: "Audit Trail" },
  { key: "approval", label: "Pending Approval" }
];

export function AdminSessionPage() {
  const { sessionId = "" } = useParams();
  const { data: session, isLoading } = useSessionQuery(sessionId);
  const { data: sessions = [] } = useSessionsQuery();
  const { data: approvals = [] } = useApprovalsQuery(sessionId);
  const endSession = useEndSessionMutation();
  const loadRecountItems = useLoadRecountItemsMutation();
  const toggleVisibility = useToggleSessionVisibilityMutation();
  const toggleStrictRoles = useToggleStrictRolesMutation();
  const pendingApprovalsCount = approvals.filter((entry) => entry.status === "Pending").length;
  const [activeTab, setActiveTab] = useState<SessionTabKey>("pairs");
  const [tvOverlayOpen, setTvOverlayOpen] = useState(false);

  const content = useMemo(() => {
    switch (activeTab) {
      case "pairs":
        return session ? (
          <PairAssignmentTab
            sessionId={sessionId}
            isRecount={session.isRecount}
            strictRoles={session.strictRoles}
            onToggleStrictRoles={async () => {
              await toggleStrictRoles.mutateAsync(session.id);
            }}
          />
        ) : null;
      case "attendance":
        return <AttendanceTab sessionId={sessionId} />;
      case "items":
        return session ? (
          <StockCountTab
            sessionId={sessionId}
            entity={session.entity}
            isRecount={session.isRecount}
            parentSessionId={session.parentId}
          />
        ) : null;
      case "dashboard":
        return <DashboardTab sessionId={sessionId} />;
      case "audit":
        return <AuditTrailTab sessionId={sessionId} />;
      case "gallery":
        return <NewItemGalleryTab sessionId={sessionId} />;
      case "approval":
        return <ApprovalTab sessionId={sessionId} />;
      default:
        return null;
    }
  }, [activeTab, session, sessionId, toggleStrictRoles]);

  if (isLoading) return <p>Loading session...</p>;
  if (!session) {
    return (
      <section className="panel">
        <h2>Session not found</h2>
        <Link to="/admin">Back to Admin Homepage</Link>
      </section>
    );
  }

  const handleOpenDashboard = () => setTvOverlayOpen(true);

  const handleToggleVisibility = async () => {
    try {
      await toggleVisibility.mutateAsync(session.id);
    } catch (error) {
      window.alert((error as Error).message);
    }
  };

  const handleEndSession = async () => {
    const ok = window.confirm(`End session "${session.name}"? This will set status to Closed.`);
    if (!ok) return;
    try {
      await endSession.mutateAsync(session.id);
    } catch (error) {
      window.alert((error as Error).message);
    }
  };

  const handleLoadRecountItems = async () => {
    try {
      const result = await loadRecountItems.mutateAsync(session.id);
      window.alert(`Loaded ${result.loaded} item(s) into recount session.`);
    } catch (error) {
      window.alert((error as Error).message);
    }
  };

  const parentSessionName =
    session?.isRecount && session.parentId ? sessions.find((entry) => entry.id === session.parentId)?.name ?? session.parentId : null;
  const linkedRecountSession = session?.isRecount ? null : sessions.find((entry) => entry.isRecount && entry.parentId === session?.id) ?? null;
  const linkedRecountName = linkedRecountSession?.name ?? null;

  return (
    <section className="session-page">
      <SessionHeader
        session={session}
        visibilityUpdating={toggleVisibility.isPending}
        endingSession={endSession.isPending}
        loadingRecountItems={loadRecountItems.isPending}
        hasLinkedRecount={linkedRecountSession !== null}
        parentSessionName={parentSessionName}
        linkedRecountName={linkedRecountName}
        onToggleVisibility={handleToggleVisibility}
        onOpenDashboard={handleOpenDashboard}
        onEndSession={handleEndSession}
        onLoadRecountItems={handleLoadRecountItems}
      />
      <div className="stab-bar">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.key}
            className={`stab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.key === "approval" && pendingApprovalsCount > 0 ? (
              <span className="badge-dot">{pendingApprovalsCount}</span>
            ) : null}
          </button>
        ))}
      </div>
      {content}
      <TvDashboardOverlay
        open={tvOverlayOpen}
        sessionName={session.name}
        sessionId={session.id}
        onClose={() => setTvOverlayOpen(false)}
      />
    </section>
  );
}
