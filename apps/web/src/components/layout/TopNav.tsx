import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useIdentity } from "../../app/IdentityContext";
import { UsersRolesModal } from "../admin/UsersRolesModal";
import { getSupabaseAuthClient } from "../../services/supabaseAuth";
import { useSessionQuery } from "../../hooks/useAdminData";

function getSessionIdFromPath(pathname: string): string {
  const matched = pathname.match(/^\/admin\/sessions\/([^/]+)/);
  return matched?.[1] ?? "";
}

export function TopNav() {
  const [usersModalOpen, setUsersModalOpen] = useState(false);
  const { identity, signOut } = useIdentity();
  const location = useLocation();
  const authClient = getSupabaseAuthClient();
  const role = identity?.role ?? "User";
  const isAdmin = role === "Admin" || role === "Super Admin";
  const isWarehouseRoute = location.pathname.startsWith("/warehouse");
  const navLinkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "nav-btn active" : "nav-btn");
  const initials = (identity?.name ?? "User")
    .split(" ")
    .filter(Boolean)
    .map((name) => name[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const activeSessionId = getSessionIdFromPath(location.pathname);
  const activeSessionQuery = useSessionQuery(activeSessionId);
  const showSessionChild = isAdmin && Boolean(activeSessionId);
  const sessionChildLabel = activeSessionQuery.data?.name || activeSessionId;

  return (
    <>
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="logo">
          <div className="logo-mark" aria-hidden="true">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="5" height="5" rx="1" fill="white" opacity="0.9" />
              <rect x="9" y="2" width="5" height="5" rx="1" fill="white" opacity="0.6" />
              <rect x="2" y="9" width="5" height="5" rx="1" fill="white" opacity="0.6" />
              <rect x="9" y="9" width="5" height="5" rx="1" fill="white" opacity="0.9" />
            </svg>
          </div>
          <div>
            <div className="logo-t">MediCount</div>
            <div className="logo-s">Everyone Counts</div>
          </div>
        </div>

        <nav className="sidebar-scroll">
          {isAdmin ? (
            <section className="top-nav-group sidebar-group" aria-label="Admin section">
              <div className="nav-sec">Admin</div>
              <NavLink to="/admin" className={navLinkClass}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
                  <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
                  <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
                  <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
                </svg>
                <span className="nav-label">Sessions</span>
              </NavLink>
              {showSessionChild ? (
                <span className="nav-child" title={sessionChildLabel}>
                  <span className="nav-child-marker" aria-hidden="true">
                    |-
                  </span>
                  <span className="nav-child-label">{sessionChildLabel}</span>
                </span>
              ) : null}
              <button type="button" className="nav-btn" onClick={() => setUsersModalOpen(true)}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M3 14c0-3 2.5-4 5-4s5 1 5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                <span className="nav-label">Users & Roles</span>
              </button>
            </section>
          ) : null}
          <section className="top-nav-group sidebar-group" aria-label="Warehouse section">
            <div className="nav-sec">Warehouse</div>
            <NavLink to="/warehouse" className={navLinkClass}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.3" />
                <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.3" />
                <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.3" />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.3" />
                <path d="M12 10.5v3M10.5 12h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <span className="nav-label">Scan & Count</span>
            </NavLink>
            <NavLink to="/history" className={navLinkClass}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
                <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="nav-label">Count History</span>
            </NavLink>
          </section>
        </nav>

        <div className="sidebar-user">
          <div className="user-avatar" aria-hidden="true">
            {initials || "?"}
          </div>
          <div className="user-meta">
            <strong>{identity?.name}</strong>
            <small>{identity?.email}</small>
          </div>
          <button
            type="button"
            className="signout-link"
            onClick={async () => {
              try {
                if (authClient) {
                  await authClient.auth.signOut();
                }
              } finally {
                signOut();
              }
            }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      <nav
        className={`mobile-nav ${isAdmin ? "mobile-nav-admin" : "mobile-nav-user"} ${isWarehouseRoute ? "mobile-nav-with-layout" : ""}`}
        aria-label="Mobile navigation"
      >
        {isWarehouseRoute ? (
          <button
            type="button"
            className="mnav-btn"
            onClick={() => {
              window.dispatchEvent(new Event("sta-mobile-layout"));
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <rect x="2" y="3" width="20" height="18" rx="2" />
              <path d="M2 9h20M9 9v12" />
            </svg>
            <span className="mnav-label">Layout</span>
          </button>
        ) : null}
        {isAdmin ? (
          <NavLink to="/admin" className={({ isActive }) => (isActive ? "mnav-btn active" : "mnav-btn")}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
              <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
              <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
              <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
            </svg>
            <span className="mnav-label">Sessions</span>
          </NavLink>
        ) : null}
        <NavLink to="/warehouse" className={({ isActive }) => (isActive ? "mnav-btn active" : "mnav-btn")}>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.3" />
            <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.3" />
            <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.3" />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.3" />
            <path d="M12 10.5v3M10.5 12h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <span className="mnav-label">Scan</span>
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => (isActive ? "mnav-btn active" : "mnav-btn")}>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
            <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="mnav-label">History</span>
        </NavLink>
      </nav>

      {isAdmin ? <UsersRolesModal open={usersModalOpen} onClose={() => setUsersModalOpen(false)} /> : null}
    </>
  );
}

