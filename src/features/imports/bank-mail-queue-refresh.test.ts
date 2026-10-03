import { beforeEach, describe, expect, it, vi } from "vitest";
import { settledHomeEpoch } from "@/features/home/invalidate-settled-home";
import { rememberImporteraRows } from "@/features/home/last-snapshot";

const surfaces = vi.hoisted(() => vi.fn());
const count = vi.hoisted(() => vi.fn());

vi.mock("@/features/imports/bank-mail-actions", () => ({
  refreshBankMailSurfacesAction: surfaces,
  pendingBankMailCountAction: count,
}));

const { refreshAfterBankMailQueueChange, retryBankMailSurfacesIfStale } =
  await import("@/features/imports/bank-mail-queue-refresh");

beforeEach(() => {
  surfaces.mockReset();
  count.mockReset();
  count.mockResolvedValue(1);
  rememberImporteraRows([
    {
      id: "mail-1",
      kind: "bank_mail",
      status: "needs_review",
      createdAt: "2026-10-02T04:10:00.000Z",
      notes: "Cafe Ett",
    },
  ]);
});

describe("refreshAfterBankMailQueueChange", () => {
  it("logs a failed background refill and refetches on the next navigation", async () => {
    surfaces.mockResolvedValue({ ok: false });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const epoch = settledHomeEpoch();

    await expect(
      refreshAfterBankMailQueueChange("mail-1", "Bekräftad och sparad"),
    ).resolves.toEqual({ ok: false });

    expect(error).toHaveBeenCalledWith(
      "[numa] bank-mail.refresh",
      "Bakgrundsrefresh misslyckades",
    );
    expect(settledHomeEpoch()).toBeGreaterThan(epoch);
    retryBankMailSurfacesIfStale();
    expect(settledHomeEpoch()).toBeGreaterThan(epoch + 1);
    const afterRetry = settledHomeEpoch();
    retryBankMailSurfacesIfStale();
    expect(settledHomeEpoch()).toBe(afterRetry);
    error.mockRestore();
  });

  it("adopts surfaces when the refill succeeds and stays quiet", async () => {
    surfaces.mockResolvedValue({
      ok: true,
      home: null,
      plan: null,
      accounts: null,
      movements: null,
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      refreshAfterBankMailQueueChange("mail-1", "Bekräftad och sparad"),
    ).resolves.toEqual({ ok: true });
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
