import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AdminSessionPage } from "./AdminSessionPage";
import { resetMockStore } from "../services/mockStore";

describe("AdminSessionPage", () => {
  beforeEach(() => {
    resetMockStore();
  });

  function renderPage() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/admin/sessions/YE2026-MY-001"]}>
          <Routes>
            <Route path="/admin/sessions/:sessionId" element={<AdminSessionPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  it("renders session tabs and switches to dashboard tab", async () => {
    renderPage();

    await screen.findByText("Year End 2026 Malaysia");
    fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
    expect(await screen.findByText("Total Items")).toBeInTheDocument();
  });

  it("toggles session visibility from the header button", async () => {
    renderPage();

    await screen.findByText("Year End 2026 Malaysia");
    fireEvent.click(screen.getByRole("button", { name: "Visible to users" }));
    expect(await screen.findByRole("button", { name: "Hidden from users" })).toBeInTheDocument();
  });

  it("ends a session after confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();

    await screen.findByText("Year End 2026 Malaysia");
    fireEvent.click(screen.getByRole("button", { name: "End session" }));
    expect(await screen.findByText("● Closed")).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("opens tv dashboard overlay from header", async () => {
    renderPage();
    await screen.findByText("Year End 2026 Malaysia");
    fireEvent.click(screen.getByRole("button", { name: "Open TV Dashboard" }));
    expect(await screen.findByRole("dialog", { name: "TV Dashboard" })).toBeInTheDocument();
    expect(screen.getByText(/Refreshes in/i)).toBeInTheDocument();
    expect(screen.queryByAltText(/Attendance QR for YE2026-MY-001/i) ?? screen.getByText(/att:YE2026-MY-001:/i)).toBeInTheDocument();
    expect(screen.getByText(/No pair attendance yet/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "TV Dashboard" })).not.toBeInTheDocument();
    });
  });

  it("edits a pair from pair assignment table", async () => {
    renderPage();
    await screen.findByText("Year End 2026 Malaysia");
    await screen.findByText("P-01");
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    fireEvent.change(screen.getByLabelText("Counter"), { target: { value: "Super Admin" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Pair" }));

    await waitFor(() => {
      expect(screen.getAllByText("Super Admin").length).toBeGreaterThan(0);
    });
  });

  it("imports users from PA in pair assignment tab", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();
    await screen.findByText("Year End 2026 Malaysia");

    fireEvent.click(screen.getByRole("button", { name: "Import users" }));

    await waitFor(() => {
      expect(screen.getByText(/Reset \d+ pair\(s\), \d+ attendance row\(s\), and unassigned \d+ item\(s\)\./i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.queryByText("P-01")).not.toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  it("imports items from SAP payload in item master tab", async () => {
    renderPage();
    await screen.findByText("Year End 2026 Malaysia");

    fireEvent.click(screen.getByRole("button", { name: "Item Master" }));
    fireEvent.click(await screen.findByRole("button", { name: "Import from SAP" }));
    const dialog = await screen.findByRole("dialog", { name: "Import from SAP" });
    fireEvent.change(screen.getByLabelText("Optional JSON payload"), {
      target: {
        value:
          '[{"id":"SAP-T1","item_code":"ITM-T1","item_name":"Test Imported 1","item_location":"SAP-A1","sap_qty":10}]'
      }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Run Import" }));

    await waitFor(() => {
      expect(screen.getByText("Imported 1 item(s).")).toBeInTheDocument();
    });
  });

  it("refreshes bins from item master toolbar", async () => {
    renderPage();
    await screen.findByText("Year End 2026 Malaysia");

    fireEvent.click(screen.getByRole("button", { name: "Item Master" }));
    fireEvent.click(await screen.findByRole("button", { name: "Refresh bins" }));

    await waitFor(() => {
      expect(screen.getByText("Imported 3 bin location(s).")).toBeInTheDocument();
    });
  });

  it("exports filtered item master rows to csv", async () => {
    renderPage();
    await screen.findByText("Year End 2026 Malaysia");

    fireEvent.click(screen.getByRole("button", { name: "Item Master" }));
    await screen.findByText("ITM-1001");
    fireEvent.click(await screen.findByRole("button", { name: "Export CSV" }));

    await waitFor(() => {
      expect(screen.getByText("Exported 3 item(s).")).toBeInTheDocument();
    });
  });

  it("supports legacy item master bulk drop flow", async () => {
    renderPage();
    await screen.findByText("Year End 2026 Malaysia");

    fireEvent.click(screen.getByRole("button", { name: "Item Master" }));
    fireEvent.click(await screen.findByRole("button", { name: /Select all 3/i }));

    await waitFor(() => {
      expect(screen.getByText("3 selected")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Drop selected" }));

    await waitFor(() => {
      expect(screen.getByText("3 item(s) dropped.")).toBeInTheDocument();
    });
  });

  it("activates all dropped items from item master toolbar", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();
    await screen.findByText("Year End 2026 Malaysia");

    fireEvent.click(screen.getByRole("button", { name: "Item Master" }));
    fireEvent.click(await screen.findByRole("button", { name: /Select all 3/i }));
    fireEvent.click(screen.getByRole("button", { name: "Drop selected" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Activate all dropped \(3\)/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Activate all dropped \(3\)/i }));

    await waitFor(() => {
      expect(screen.getByText("3 item(s) activated.")).toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  it("shows submitted new items in gallery without approval actions", async () => {
    renderPage();
    await screen.findByText("Year End 2026 Malaysia");

    fireEvent.click(screen.getByRole("button", { name: "New Item Gallery" }));
    expect(await screen.findByText(/N-001 - Unknown Adapter/i)).toBeInTheDocument();
    expect(screen.getByText("Status: Pending")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });

  it("renders pending approval table with old/new bin columns", async () => {
    renderPage();
    await screen.findByText("Year End 2026 Malaysia");

    fireEvent.click(screen.getByRole("button", { name: /Pending Approval/i }));
    expect(await screen.findByText("Old Bin")).toBeInTheDocument();
    expect(screen.getByText("New Bin")).toBeInTheDocument();
  });
});
