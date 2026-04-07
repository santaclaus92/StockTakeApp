import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { IdentityProvider } from "./IdentityContext";
import { RoleGuard } from "./RoleGuard";

function setIdentity(role: "User" | "Admin" | "Super Admin") {
  localStorage.setItem(
    "sta_identity",
    JSON.stringify({
      id: `test-${role.toLowerCase().replace(/\s+/g, "-")}`,
      name: `${role} Tester`,
      email: `${role.toLowerCase().replace(/\s+/g, ".")}@example.com`,
      role
    })
  );
}

function renderRoutes(path: string) {
  return render(
    <IdentityProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<RoleGuard allow={["Admin", "Super Admin"]} />}>
            <Route path="/admin" element={<h2>Admin Route</h2>} />
          </Route>
          <Route element={<RoleGuard allow={["User", "Admin", "Super Admin"]} />}>
            <Route path="/warehouse" element={<h2>Warehouse Route</h2>} />
          </Route>
          <Route path="*" element={<h2>Not Found</h2>} />
        </Routes>
      </MemoryRouter>
    </IdentityProvider>
  );
}

describe("RoleGuard", () => {
  beforeEach(() => {
    localStorage.removeItem("sta_identity");
  });

  it("redirects User away from admin route to warehouse route", async () => {
    setIdentity("User");
    renderRoutes("/admin");

    expect(await screen.findByRole("heading", { name: "Warehouse Route" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Admin Route" })).not.toBeInTheDocument();
  });

  it("allows Admin to access admin route", async () => {
    setIdentity("Admin");
    renderRoutes("/admin");

    expect(await screen.findByRole("heading", { name: "Admin Route" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Warehouse Route" })).not.toBeInTheDocument();
  });
});
