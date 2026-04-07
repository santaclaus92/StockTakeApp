import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewSessionModal } from "./NewSessionModal";

describe("NewSessionModal", () => {
  const onCreate = vi.fn(async () => undefined);

  beforeEach(() => {
    onCreate.mockClear();
  });

  it("shows validation errors when required fields are missing", async () => {
    render(<NewSessionModal open loading={false} onClose={() => undefined} onCreate={onCreate} />);

    fireEvent.click(screen.getByRole("button", { name: "Create Session" }));

    await waitFor(() => {
      expect(screen.getByText("Session name must be at least 3 characters.")).toBeInTheDocument();
      expect(screen.getByText("Start date is required.")).toBeInTheDocument();
      expect(screen.getByText("End date is required.")).toBeInTheDocument();
    });
    expect(onCreate).not.toHaveBeenCalled();
  });
});
