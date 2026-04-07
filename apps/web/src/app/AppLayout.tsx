import { Outlet, useLocation } from "react-router-dom";
import { TopNav } from "../components/layout/TopNav";
import { useSessionQuery } from "../hooks/useAdminData";

function getBreadcrumb(pathname: string): { root: string; current?: string } {
  if (pathname.startsWith("/admin/sessions/")) {
    return { root: "Sessions", current: "Session" };
  }
  if (pathname.startsWith("/admin")) {
    return { root: "Sessions" };
  }
  if (pathname.startsWith("/warehouse")) {
    return { root: "Scan & Count" };
  }
  if (pathname.startsWith("/history")) {
    return { root: "Count History" };
  }
  return { root: "Sessions" };
}

function getSessionIdFromPath(pathname: string): string {
  const matched = pathname.match(/^\/admin\/sessions\/([^/]+)/);
  return matched?.[1] ?? "";
}

export function AppLayout() {
  const location = useLocation();
  const breadcrumb = getBreadcrumb(location.pathname);
  const sessionId = getSessionIdFromPath(location.pathname);
  const sessionQuery = useSessionQuery(sessionId);
  const currentLabel = sessionQuery.data?.name || breadcrumb.current;

  return (
    <div className="app-shell">
      <TopNav />
      <section className="main-shell">
        <header className="topbar">
          <div className="bc">
            <span className="bc-btn">{breadcrumb.root}</span>
            {currentLabel ? (
              <>
                <span className="bc-sep">&gt;</span>
                <span className="bc-cur">{currentLabel}</span>
              </>
            ) : null}
          </div>
          <div className="topbar-right" />
        </header>
        <main className="content">
          <Outlet />
        </main>
      </section>
    </div>
  );
}
