import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  profile: vi.fn(),
  stamp: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: mocks.invalidate,
}));
vi.mock("@/lib/store/repository", () => ({
  confirmReceiptExpense: mocks.confirm,
  getProfile: mocks.profile,
  getTodaySnapshot: vi.fn(),
  stampOnboardingSaldoAt: mocks.stamp,
  stampOnboardingCompletedAt: mocks.stamp,
  uploadReceiptAndExtract: vi.fn(),
}));
vi.mock("@/features/plan/sync-settle-ledger", () => ({
  reclaimStalePlanSettleLedgers: vi.fn(),
}));
vi.mock("@/features/finance/mutation-refresh", () => ({
  SAVED_REFRESH_PENDING_SV: "Sparat. Uppdaterar siffrorna…",
}));
vi.mock("@/lib/observe/report", () => ({ reportError: vi.fn() }));

import { confirmReceiptExpenseAction } from "./actions";

const MUTATION_ID = "33333333-3333-4333-8333-333333333333";
const input = {
  observationId: "11111111-1111-4111-8111-111111111111",
  amount: "100",
  source: "screenshot" as const,
  clientMutationId: MUTATION_ID,
};

describe("committed screenshot confirmation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const ledger: Array<{
      id: string;
      clientMutationId: string | null;
      balanceAfterMinor: number;
      amountMinor: number;
      direction: "debit";
    }> = [];
    mocks.confirm.mockImplementation(
      async (raw: { clientMutationId?: string | null }) => {
        const existing = ledger.find(
          (row) =>
            raw.clientMutationId &&
            row.clientMutationId === raw.clientMutationId,
        );
        if (existing) return existing;
        const tx = {
          id: "tx-import-1",
          clientMutationId: raw.clientMutationId ?? null,
          balanceAfterMinor: 50000,
          amountMinor: 10000,
          direction: "debit" as const,
        };
        ledger.push(tx);
        return tx;
      },
    );
  });

  it("returns saved when the profile read after importing fails", async () => {
    mocks.profile.mockRejectedValue(new Error("offline"));
    const result = await confirmReceiptExpenseAction(input);
    expect(result).toMatchObject({
      ok: true,
      refreshPending: true,
      data: { balanceAfterMinor: 50000, amountMinor: 10000 },
    });
    expect(mocks.confirm).toHaveBeenCalledOnce();
  });

  it("returns saved if onboarding and cache invalidation both fail", async () => {
    mocks.stamp.mockRejectedValue(new Error("onboarding unavailable"));
    mocks.invalidate.mockImplementation(() => {
      throw new Error("cache unavailable");
    });
    expect(
      await confirmReceiptExpenseAction({ ...input, fromOnboarding: true }),
    ).toMatchObject({ ok: true, refreshPending: true });
    expect(mocks.confirm).toHaveBeenCalledOnce();
  });

  it("retries the same mutation id without a second import", async () => {
    mocks.profile.mockRejectedValue(new Error("offline"));
    const first = await confirmReceiptExpenseAction(input);
    const second = await confirmReceiptExpenseAction(input);
    expect(first).toMatchObject({ ok: true, refreshPending: true });
    expect(second).toMatchObject({ ok: true, refreshPending: true });
    expect(mocks.confirm).toHaveBeenCalledTimes(2);
    expect(mocks.confirm.mock.calls[0]?.[0]).toMatchObject({
      clientMutationId: MUTATION_ID,
    });
  });

  it("still returns a failure if the actual import fails", async () => {
    mocks.confirm.mockRejectedValue(new Error("Import misslyckades"));
    expect(await confirmReceiptExpenseAction(input)).toEqual({
      ok: false,
      error: "Import misslyckades",
    });
    expect(mocks.profile).not.toHaveBeenCalled();
  });
});
