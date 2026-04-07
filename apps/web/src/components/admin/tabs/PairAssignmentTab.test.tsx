import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PairAssignmentTab } from "./PairAssignmentTab";
import { mockStore, resetMockStore } from "../../../services/mockStore";

describe("PairAssignmentTab", () => {
  beforeEach(() => {
    resetMockStore();
  });

  function renderTab(options?: { isRecount?: boolean }) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PairAssignmentTab
          sessionId="YE2026-MY-001"
          isRecount={options?.isRecount ?? true}
          strictRoles={false}
          onToggleStrictRoles={vi.fn()}
        />
      </QueryClientProvider>
    );
  }

  it("refreshes bins automatically when pair assignment tab is opened", async () => {
    const importBinsSpy = vi.spyOn(mockStore, "importBinsFromPa");
    renderTab();

    await waitFor(() => {
      expect(importBinsSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("opens recount drawer and filters assigned items", async () => {
    renderTab();
    await screen.findByText("P-01");

    fireEvent.click(screen.getByText("P-01"));
    const drawer = await screen.findByRole("dialog", { name: "Recount Pair Drawer" });

    expect(within(drawer).getByText("ITM-1001")).toBeInTheDocument();
    expect(within(drawer).getByText("ITM-1003")).toBeInTheDocument();

    fireEvent.change(within(drawer).getByRole("textbox", { name: "Search drawer items" }), {
      target: { value: "ITM-1003" }
    });

    await waitFor(() => {
      expect(within(drawer).queryByText("ITM-1001")).not.toBeInTheDocument();
      expect(within(drawer).getByText("ITM-1003")).toBeInTheDocument();
    });
  });

  it("replaces an absent pair member from repair flow", async () => {
    renderTab();
    await screen.findByText("P-02");

    fireEvent.click(screen.getByText("P-02"));
    const drawer = await screen.findByRole("dialog", { name: "Recount Pair Drawer" });
    fireEvent.click(within(drawer).getByRole("button", { name: "Replace absent member" }));

    const repair = await screen.findByRole("dialog", { name: "Repair Pair" });
    fireEvent.click(within(repair).getByRole("button", { name: /Admin User/i }));
    fireEvent.click(within(repair).getByRole("button", { name: "Confirm Replacement" }));

    await waitFor(() => {
      expect(screen.getByText("Admin User")).toBeInTheDocument();
    });
  });

  it("opens edit pair in modal with full dropdown options", async () => {
    renderTab({ isRecount: false });
    await screen.findByText("P-01");

    fireEvent.click(screen.getByText("P-01"));
    const dialog = await screen.findByRole("dialog", { name: "Edit Pair" });

    const counterSelect = within(dialog).getByLabelText("Counter");
    expect(within(counterSelect).getByRole("option", { name: "Admin User" })).toBeInTheDocument();
    expect(within(counterSelect).getByRole("option", { name: "Counter User" })).toBeInTheDocument();
    expect(within(counterSelect).getByRole("option", { name: "Super Admin" })).toBeInTheDocument();

    fireEvent.change(counterSelect, { target: { value: "Admin User" } });
    fireEvent.change(within(dialog).getByLabelText("Checker"), { target: { value: "Counter User" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Pair" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Edit Pair" })).not.toBeInTheDocument();
    });

    const pairOneCard = screen.getByText("P-01").closest("article");
    expect(pairOneCard).not.toBeNull();
    expect(within(pairOneCard as HTMLElement).getByText("Admin User")).toBeInTheDocument();
    expect(within(pairOneCard as HTMLElement).getByText("Counter User")).toBeInTheDocument();
  });
});
