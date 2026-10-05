import { beforeEach, describe, expect, it, vi } from "vitest";
import { settledHomeEpoch } from "@/features/home/invalidate-settled-home";
import { rememberImporteraRows } from "@/features/home/last-snapshot";
import { resetRememberedPendingBankMailCountForTests } from "@/features/home/last-snapshot-persist";

const surfaces = vi.hoisted(() => vi.fn());
const count = vi.hoisted(() => vi.fn());

vi.mock("@/features/imports/bank-mail-actions", () => ({
  refreshBankMailSurfacesAction: surfaces,
}));

vi.mock("@/lib/numa/read-client", () => ({
  readPendingBankMailCount: count,
}));

const {
  bankMailPendingCountSnapshot,
  bankMailPendingCountVersion,
  publishBankMailPendingCount,
  publishBankMailPendingCountIfCurrent,
  refreshAfterBankMailQueueChange,
  retryBankMailSurfacesIfStale,
  seedBankMailPendingCount,
} = await import("@/features/imports/bank-mail-queue-refresh");
const { resetBankMailPendingCountForTests } = await import(
  "@/features/imports/bank-mail-pending-store"
);

beforeEach(() => {
  resetBankMailPendingCountForTests();
  resetRememberedPendingBankMailCountForTests();
  surfaces.mockReset();
  count.mockReset();
  count.mockResolvedValue({ ok: true, count: 1 });
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

describe("bank mail pending count seed and version guard", () => {
  it("paints a last-known count without counting as a newer publish", () => {
    seedBankMailPendingCount(2);
    expect(bankMailPendingCountSnapshot()).toBe(2);
    expect(bankMailPendingCountVersion()).toBe(0);

    const seen = bankMailPendingCountVersion();
    expect(publishBankMailPendingCountIfCurrent(seen, 4)).toBe(true);
    expect(bankMailPendingCountSnapshot()).toBe(4);
    expect(bankMailPendingCountVersion()).toBe(1);
  });

  it("keeps a confirm that landed while the Hem read was in flight", () => {
    seedBankMailPendingCount(2);
    const seenAtReadStart = bankMailPendingCountVersion();

    publishBankMailPendingCount(1);
    expect(publishBankMailPendingCountIfCurrent(seenAtReadStart, 2)).toBe(
      false,
    );
    expect(bankMailPendingCountSnapshot()).toBe(1);
    expect(bankMailPendingCountVersion()).toBe(1);
  });

  it("does not let a late seed overwrite a count that is already known", () => {
    publishBankMailPendingCount(0);
    seedBankMailPendingCount(3);
    expect(bankMailPendingCountSnapshot()).toBe(0);
  });

  it("treats zero as known so a later shell cannot flash the cue", () => {
    seedBankMailPendingCount(0);
    expect(bankMailPendingCountSnapshot()).toBe(0);
    expect(bankMailPendingCountVersion()).toBe(0);
    expect(publishBankMailPendingCountIfCurrent(0, 0)).toBe(true);
    expect(bankMailPendingCountSnapshot()).toBe(0);
  });
});
