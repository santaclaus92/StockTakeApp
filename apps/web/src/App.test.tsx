import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";
import { IdentityProvider } from "./app/IdentityContext";
import { TopNav } from "./components/layout/TopNav";

describe("App", () => {
  beforeEach(() => {
    localStorage.removeItem("sta_identity");
    window.history.replaceState({}, "", "/");
  });

  it("shows sso overlay and allows entering the app", async () => {
    render(<App />);

    expect(screen.getByRole("dialog", { name: "SSO Sign-In" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "test@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send OTP" }));
    fireEvent.change(screen.getByLabelText("OTP"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify & Continue" }));

    expect(await screen.findByRole("heading", { name: "Sessions" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Admin section" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Warehouse section" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toHaveClass("mobile-nav-admin");
  });

  it("shows only warehouse section for user role", async () => {
    localStorage.setItem(
      "sta_identity",
      JSON.stringify({
        id: "user-1",
        name: "Count User",
        email: "user@example.com",
        role: "User"
      })
    );

    render(<App />);

    expect(await screen.findByRole("region", { name: "Warehouse section" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Admin section" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Scan & Count" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Count History" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toHaveClass("mobile-nav-user");
  });

  it("redirects user role away from /admin to warehouse", async () => {
    localStorage.setItem(
      "sta_identity",
      JSON.stringify({
        id: "user-2",
        name: "Warehouse User",
        email: "warehouse.user@example.com",
        role: "User"
      })
    );
    window.history.replaceState({}, "", "/admin");

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Select Session" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sessions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Admin section" })).not.toBeInTheDocument();
  });

  it("shows active session name as a child item under Sessions in sidebar", async () => {
    localStorage.setItem(
      "sta_identity",
      JSON.stringify({
        id: "admin-1",
        name: "Admin User",
        email: "admin@example.com",
        role: "Admin"
      })
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });

    render(
      <IdentityProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/admin/sessions/YE2026-MY-001"]}>
            <TopNav />
          </MemoryRouter>
        </QueryClientProvider>
      </IdentityProvider>
    );

    const adminSection = await screen.findByRole("region", { name: "Admin section" });
    await waitFor(() => {
      expect(within(adminSection).getByText("Year End 2026 Malaysia")).toBeInTheDocument();
    });
    expect(within(adminSection).queryByText(/^Session$/)).not.toBeInTheDocument();
  });
});
