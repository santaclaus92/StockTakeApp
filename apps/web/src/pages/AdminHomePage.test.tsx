import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminHomePage } from "./AdminHomePage";
import { resetMockStore } from "../services/mockStore";
import { renderWithProviders } from "../test/renderWithProviders";

describe("AdminHomePage", () => {
  beforeEach(() => {
    resetMockStore();
  });

  it("creates a session from modal and shows it in the table", async () => {
    renderWithProviders(<AdminHomePage />, "/admin");

    await screen.findByText("Year End 2026 Malaysia");

    fireEvent.click(screen.getByRole("button", { name: "Create Session" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Session Name"), {
      target: { value: "Cycle Count Malaysia Test" }
    });
    fireEvent.change(within(dialog).getByLabelText("Start Date"), {
      target: { value: "2026-05-01" }
    });
    fireEvent.change(within(dialog).getByLabelText("End Date"), {
      target: { value: "2026-05-31" }
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Create Session" }));

    await waitFor(() => {
      expect(screen.getByText("Cycle Count Malaysia Test")).toBeInTheDocument();
    });
  });

  it("edits a session from the table", async () => {
    renderWithProviders(<AdminHomePage />, "/admin");
    await screen.findByText("Cycle Count Q2 Singapore");

    const row = screen.getByText("Cycle Count Q2 Singapore").closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(within(row as HTMLTableRowElement).getByRole("button", { name: "Edit" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Session Name"), {
      target: { value: "Cycle Count Q2 Singapore (Edited)" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(screen.getByText("Cycle Count Q2 Singapore (Edited)")).toBeInTheDocument();
    });
  });

  it("deletes a session from the table after confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderWithProviders(<AdminHomePage />, "/admin");
    await screen.findByText("Cycle Count Q2 Singapore");

    const row = screen.getByText("Cycle Count Q2 Singapore").closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(within(row as HTMLTableRowElement).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByText("Cycle Count Q2 Singapore")).not.toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });
});
