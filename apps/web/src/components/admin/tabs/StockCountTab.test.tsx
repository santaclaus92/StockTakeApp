import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import { StockCountTab } from "./StockCountTab";
import { buildItemMasterLayoutStorageKey, calculateDefaultColumnWidth } from "./stockCountLayout";
import { resetMockStore } from "../../../services/mockStore";

describe("StockCountTab", () => {
  beforeEach(() => {
    resetMockStore();
    sessionStorage.clear();
    localStorage.clear();
  });

  function renderTab() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <StockCountTab sessionId="YE2026-MY-001" entity="BMS" isRecount={false} />
      </QueryClientProvider>
    );
  }

  it("uses char-count based default column widths so headers fit in one line by default", async () => {
    renderTab();
    await screen.findByText("ITM-1001");

    const warehouseHeader = screen.getByRole("columnheader", { name: /Warehouse Code/i });
    const countedHeader = screen.getByRole("columnheader", { name: /Counted Qty/i });

    expect(parseInt(warehouseHeader.style.width, 10)).toBe(calculateDefaultColumnWidth("Warehouse Code"));
    expect(parseInt(countedHeader.style.width, 10)).toBe(calculateDefaultColumnWidth("Counted Qty"));
  });

  it("persists resized width and column arrangement per user in session storage", async () => {
    localStorage.setItem(
      "sta_identity",
      JSON.stringify({
        id: "admin-user-1",
        name: "Admin User",
        email: "admin@example.com",
        role: "Admin"
      })
    );

    const { unmount } = renderTab();
    await screen.findByText("ITM-1001");

    const codeHeader = screen.getByRole("columnheader", { name: /Item code/i });
    const statusHeader = screen.getByRole("columnheader", { name: /^Status$/i });
    const transfer = {
      effectAllowed: "move",
      setData: () => undefined,
      getData: () => ""
    };

    fireEvent.dragStart(codeHeader, { dataTransfer: transfer });
    fireEvent.dragOver(statusHeader, { dataTransfer: transfer });
    fireEvent.drop(statusHeader, { dataTransfer: transfer });
    fireEvent.dragEnd(codeHeader);

    await waitFor(() => {
      const headerTexts = screen
        .getAllByRole("columnheader")
        .map((header) => (header.textContent ?? "").trim())
        .filter(Boolean);
      expect(headerTexts.indexOf("Item code")).toBeLessThan(headerTexts.indexOf("Status"));
    });

    const warehouseHeader = screen.getByRole("columnheader", { name: /Warehouse Code/i });
    const defaultWarehouseWidth = calculateDefaultColumnWidth("Warehouse Code");
    const resizer = warehouseHeader.querySelector(".item-col-resizer");
    expect(resizer).toBeTruthy();

    fireEvent.mouseDown(resizer as Element, { clientX: 200 });
    fireEvent.mouseMove(window, { clientX: 280 });
    fireEvent.mouseUp(window);

    const storageKey = buildItemMasterLayoutStorageKey("admin-user-1", "YE2026-MY-001");
    let savedWarehouseWidth = defaultWarehouseWidth;

    await waitFor(() => {
      const raw = sessionStorage.getItem(storageKey);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw as string) as {
        columnOrder: string[];
        columnWidths: Record<string, number>;
      };
      expect(parsed.columnOrder.indexOf("code")).toBeLessThan(parsed.columnOrder.indexOf("status"));
      expect(parsed.columnWidths.whcode).toBeGreaterThan(defaultWarehouseWidth);
      savedWarehouseWidth = parsed.columnWidths.whcode;
    });

    unmount();
    renderTab();
    await screen.findByText("ITM-1001");

    const restoredHeaderTexts = screen
      .getAllByRole("columnheader")
      .map((header) => (header.textContent ?? "").trim())
      .filter(Boolean);
    expect(restoredHeaderTexts.indexOf("Item code")).toBeLessThan(restoredHeaderTexts.indexOf("Status"));

    const restoredWarehouseHeader = screen.getByRole("columnheader", { name: /Warehouse Code/i });
    expect(parseInt(restoredWarehouseHeader.style.width, 10)).toBe(savedWarehouseWidth);
  });
});
