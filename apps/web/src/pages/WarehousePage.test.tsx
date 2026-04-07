import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { WarehousePage } from "./WarehousePage";
import { mockStore, resetMockStore } from "../services/mockStore";
import { renderWithProviders } from "../test/renderWithProviders";

describe("WarehousePage", () => {
  beforeEach(() => {
    resetMockStore();
  });

  it("submits count from warehouse count input form", async () => {
    renderWithProviders(<WarehousePage />, "/warehouse");

    fireEvent.click(await screen.findByText("Year End 2026 Malaysia"));
    await screen.findByText("Assigned Items Gallery");
    fireEvent.change(screen.getByPlaceholderText(/Item code, name or batch/i), {
      target: { value: "ITM-1001" }
    });
    fireEvent.click((await screen.findAllByText("ITM-1001"))[0]);
    fireEvent.change(screen.getByLabelText("Count Qty"), {
      target: { value: "51" }
    });
    fireEvent.change(screen.getByLabelText("Submitted By"), {
      target: { value: "Warehouse Tester" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit Count" }));

    await waitFor(() => {
      expect(screen.getByText("Count submitted.")).toBeInTheDocument();
    });
  });

  it("marks attendance when scanning admin attendance token", async () => {
    renderWithProviders(<WarehousePage />, "/warehouse");

    fireEvent.click(await screen.findByText("Year End 2026 Malaysia"));
    await screen.findByText("Assigned Items Gallery");

    fireEvent.click(screen.getByRole("button", { name: "Scan" }));
    const tokenMinute = Math.floor(Date.now() / 60_000);
    fireEvent.change(screen.getByLabelText("Scanned Code"), {
      target: { value: `att:YE2026-MY-001:${tokenMinute}` }
    });

    fireEvent.click(screen.getByRole("button", { name: "Mark Attendance" }));

    await waitFor(() => {
      expect(screen.getByText(/Check-in recorded!/i)).toBeInTheDocument();
    });
  });

  it("offers add-as-new-item when search has no results and prefills item code", async () => {
    renderWithProviders(<WarehousePage />, "/warehouse");

    fireEvent.click(await screen.findByText("Year End 2026 Malaysia"));
    fireEvent.change(screen.getByPlaceholderText(/Item code, name or batch/i), {
      target: { value: "MISSING-404" }
    });

    await waitFor(() => {
      expect(screen.getAllByText("No items matched your search.").length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByRole("button", { name: /Add as new item/i }));

    const codeInput = await screen.findByLabelText("Item Code");
    expect((codeInput as HTMLInputElement).value).toBe("MISSING-404");
  });

  it("submits extended new item fields from warehouse form", async () => {
    renderWithProviders(<WarehousePage />, "/warehouse");

    fireEvent.click(await screen.findByText("Year End 2026 Malaysia"));
    await screen.findByText("Assigned Items Gallery");

    fireEvent.click(screen.getByRole("button", { name: /\+ New/i }));

    fireEvent.change(await screen.findByLabelText("Item Code"), {
      target: { value: "NEW-9990" }
    });
    fireEvent.change(screen.getByLabelText("Item Name"), {
      target: { value: "Scanner Cradle" }
    });
    fireEvent.change(screen.getByLabelText("UOM"), {
      target: { value: "PCS" }
    });
    fireEvent.change(screen.getByLabelText("Serial / Batch No."), {
      target: { value: "BT-NEW-9990" }
    });
    fireEvent.change(screen.getByLabelText("Bin Location"), {
      target: { value: "A-09" }
    });
    fireEvent.change(screen.getByLabelText("Counted Qty"), {
      target: { value: "4" }
    });
    fireEvent.change(screen.getByLabelText("Damaged Qty"), {
      target: { value: "1" }
    });
    fireEvent.change(screen.getByLabelText("Expired Qty"), {
      target: { value: "0" }
    });
    fireEvent.change(screen.getByLabelText("Remark"), {
      target: { value: "Found during scan pass." }
    });

    const photoInput = screen.getByLabelText(/Photos \(at least one required\)/i);
    fireEvent.change(photoInput, {
      target: {
        files: [new File(["demo"], "new-item-1.jpg", { type: "image/jpeg" })]
      }
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit New Item" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Add New Item" })).not.toBeInTheDocument();
    });

    const newItems = await mockStore.listNewItems("YE2026-MY-001");
    const created = newItems.find((item) => item.code === "NEW-9990");
    expect(created).toBeTruthy();
    expect(created?.uom).toBe("PCS");
    expect(created?.batch).toBe("BT-NEW-9990");
    expect(created?.qty).toBe(4);
    expect(created?.photos?.length).toBe(1);
  });

  it("processes multi-scan one code at a time and logs updates", async () => {
    renderWithProviders(
      <WarehousePage />,
      "/warehouse",
      { id: "u-ahmad", name: "Ahmad Hassan", email: "ahmad@example.com", role: "Admin" }
    );

    fireEvent.click(await screen.findByText("Year End 2026 Malaysia"));
    await screen.findByText("Assigned Items Gallery");
    fireEvent.change(screen.getByPlaceholderText(/Item code, name or batch/i), {
      target: { value: "ITM-1003" }
    });
    await screen.findAllByText("ITM-1003");

    fireEvent.click(screen.getByRole("button", { name: "Multi-Scan" }));
    fireEvent.change(screen.getByPlaceholderText("Waiting for scan..."), {
      target: { value: "ITM-1003" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Process Scan" }));

    await waitFor(() => {
      expect(screen.getByText(/Updated ITM-1003 -> 1/i)).toBeInTheDocument();
      expect(screen.getByText("1", { selector: ".cv-ms-num" })).toBeInTheDocument();
    });
  });

  it("hides multi-scan action for user role", async () => {
    renderWithProviders(
      <WarehousePage />,
      "/warehouse",
      { id: "u-1", name: "Warehouse User", email: "user@example.com", role: "User" }
    );

    fireEvent.click(await screen.findByText("Year End 2026 Malaysia"));
    await screen.findByText("Assigned Items Gallery");
    expect(screen.queryByRole("button", { name: "Multi-Scan" })).not.toBeInTheDocument();
  });
});
