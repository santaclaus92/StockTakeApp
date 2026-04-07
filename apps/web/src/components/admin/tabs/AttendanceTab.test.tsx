import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttendanceTab } from "./AttendanceTab";
import { resetMockStore } from "../../../services/mockStore";

const { toDataUrlMock } = vi.hoisted(() => ({
  toDataUrlMock: vi.fn(async (value: string) => `data:image/png;base64,${value}`)
}));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: toDataUrlMock
  }
}));

describe("AttendanceTab", () => {
  beforeEach(() => {
    resetMockStore();
    toDataUrlMock.mockClear();
    vi.useRealTimers();
  });

  function renderTab() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <AttendanceTab sessionId="YE2026-MY-001" />
      </QueryClientProvider>
    );
  }

  it("renders 4 attendance timing slots in one horizontal row per card", async () => {
    renderTab();
    const name = await screen.findByText("Ahmad Hassan");
    const card = name.closest(".att-card");
    expect(card).toBeTruthy();

    const timesInline = card?.querySelector(".att-times.att-times-inline");
    expect(timesInline).toBeTruthy();
    expect(timesInline?.querySelectorAll(".att-time-row").length).toBe(4);
  });

  it("auto-regenerates attendance QR every 60 seconds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T00:00:00.000Z"));

    renderTab();
    await act(async () => {
      vi.advanceTimersByTime(0);
    });
    expect(toDataUrlMock).toHaveBeenCalled();
    const firstToken = String(toDataUrlMock.mock.calls[0]?.[0] ?? "");

    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    await act(async () => {
      vi.advanceTimersByTime(0);
    });
    expect(toDataUrlMock.mock.calls.length).toBeGreaterThan(1);
    const secondToken = String(toDataUrlMock.mock.calls[toDataUrlMock.mock.calls.length - 1]?.[0] ?? "");

    expect(secondToken).not.toBe(firstToken);
  });
});
