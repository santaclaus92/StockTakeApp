import { Outlet } from "react-router-dom";
import { TopNav } from "../components/layout/TopNav";

export function AppLayout() {
  return (
    <div className="app-shell">
      <TopNav />
      <section className="main-shell">
        <main className="content">
          <Outlet />
        </main>
      </section>
    </div>
  );
}
