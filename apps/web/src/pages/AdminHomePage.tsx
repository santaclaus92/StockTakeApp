import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NewSessionModal } from "../components/admin/NewSessionModal";
import {
  useCreateSessionMutation,
  useDeleteSessionMutation,
  useReopenSessionMutation,
  useSessionsQuery,
  useUpdateSessionMutation
} from "../hooks/useAdminData";
import type { NewSessionInput, Session } from "../types/domain";
import { formatLegacyDateRange } from "../utils/legacyDate";

function resolveSessionStatusClass(status: Session["status"]): string {
  if (status === "Active") return "b-success";
  if (status === "Closed") return "b-gray";
  return "b-warn";
}

export function AdminHomePage() {
  const { data: sessions = [], isLoading } = useSessionsQuery();
  const createSession = useCreateSessionMutation();
  const updateSession = useUpdateSessionMutation();
  const reopenSession = useReopenSessionMutation();
  const deleteSession = useDeleteSessionMutation();
  const navigate = useNavigate();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);

  const handleCreate = async (input: NewSessionInput) => {
    try {
      await createSession.mutateAsync(input);
    } catch (error) {
      window.alert((error as Error).message);
    }
  };

  const handleEdit = async (input: NewSessionInput) => {
    if (!editingSession) return;
    try {
      await updateSession.mutateAsync({ sessionId: editingSession.id, input });
      setEditingSession(null);
    } catch (error) {
      window.alert((error as Error).message);
    }
  };

  const handleReopen = async (session: Session) => {
    const ok = window.confirm(`Reopen session "${session.name}"? Status will become Active.`);
    if (!ok) return;
    try {
      await reopenSession.mutateAsync(session.id);
    } catch (error) {
      window.alert((error as Error).message);
    }
  };

  const handleDelete = async (session: Session) => {
    const ok = window.confirm(`Delete session "${session.name}"? This cannot be undone.`);
    if (!ok) return;
    try {
      await deleteSession.mutateAsync({ sessionId: session.id });
    } catch (error) {
      window.alert((error as Error).message);
    }
  };

  return (
    <section className="panel">
      <header className="sessions-page-head">
        <h2 className="sessions-page-title">Sessions</h2>
        <button onClick={() => setCreateModalOpen(true)} aria-label="Create Session" className="btn btn-primary btn-sm">
          + New session
        </button>
      </header>

      {isLoading ? <p>Loading sessions...</p> : null}
      <div className="card sessions-table-card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Session</th>
              <th>Type</th>
              <th>Entity</th>
              <th>Dates</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Created By</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr
                key={session.id}
                className={`session-row ${session.userVisible ? "" : "session-row-hidden"}`}
                onClick={() => navigate(`/admin/sessions/${session.id}`)}
              >
                <td>
                  <div className="session-name-cell">
                    <div className="session-name-title-row">
                      <span className="session-name-title" title={session.name}>
                        {session.name}
                      </span>
                      {session.isRecount ? <span className="badge b-purple session-type-badge">Recount</span> : null}
                    </div>
                    <small title={session.id}>{session.id}</small>
                  </div>
                </td>
                <td title={session.type}>{session.type}</td>
                <td title={session.entity}>{session.entity}</td>
                <td title={formatLegacyDateRange(session.startDate, session.endDate)}>{formatLegacyDateRange(session.startDate, session.endDate)}</td>
                <td>
                  <span className={`badge ${resolveSessionStatusClass(session.status)}`}>{session.status}</span>
                </td>
                <td>
                  <div className="session-progress-cell">
                    <div className="prog-bar session-progress-bar">
                      <div
                        className="prog-fill"
                        style={{ width: `${session.progress}%`, background: session.progress >= 100 ? "#1D9E75" : undefined }}
                      />
                    </div>
                    <span className="session-progress-value">{session.progress}%</span>
                  </div>
                </td>
                <td title={session.createdBy ?? "-"}>{session.createdBy ?? "-"}</td>
                <td>
                  <div className="session-actions-cell">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditingSession(session);
                      }}
                      className="btn btn-sm"
                    >
                      Edit
                    </button>
                    {session.status === "Closed" ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleReopen(session);
                        }}
                        className="btn btn-sm session-reopen-btn"
                      >
                        Reopen
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDelete(session);
                      }}
                      className="btn btn-sm session-delete-btn"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <NewSessionModal
        open={createModalOpen}
        loading={createSession.isPending}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreate}
        existingSessions={sessions}
      />
      <NewSessionModal
        open={Boolean(editingSession)}
        loading={updateSession.isPending}
        onClose={() => setEditingSession(null)}
        onCreate={handleEdit}
        existingSessions={sessions}
        mode="edit"
        initialSession={editingSession}
      />
    </section>
  );
}
