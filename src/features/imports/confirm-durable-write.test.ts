import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ confirm: vi.fn(), profile: vi.fn(), stamp: vi.fn(), invalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: mocks.invalidate }));
vi.mock("@/lib/store/repository", () => ({ confirmReceiptExpense: mocks.confirm, getProfile: mocks.profile, getTodaySnapshot: vi.fn(), stampOnboardingSaldoAt: mocks.stamp, stampOnboardingCompletedAt: mocks.stamp, uploadReceiptAndExtract: vi.fn() }));
vi.mock("@/features/plan/sync-settle-ledger", () => ({ reclaimStalePlanSettleLedgers: vi.fn() }));
vi.mock("@/features/finance/mutation-refresh", () => ({ SAVED_REFRESH_PENDING_SV: "Sparat. Uppdaterar siffrorna…" }));
vi.mock("@/lib/observe/report", () => ({ reportError: vi.fn() }));
import { confirmReceiptExpenseAction } from "./actions";
const input = { observationId: "11111111-1111-4111-8111-111111111111", amount: "100", source: "screenshot" as const };
describe("committed screenshot confirmation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.confirm.mockResolvedValue({ balanceAfterMinor: 50000, amountMinor: 10000, direction: "debit" });
  });
  it("returns saved when the profile read after importing fails", async () => {
    mocks.profile.mockRejectedValue(new Error("offline"));
    const result = await confirmReceiptExpenseAction(input);
    expect(result).toMatchObject({ ok: true, refreshPending: true, data: { balanceAfterMinor: 50000, amountMinor: 10000 } });
    expect(mocks.confirm).toHaveBeenCalledOnce();
  });
  it("returns saved if onboarding and cache invalidation both fail", async () => {
    mocks.stamp.mockRejectedValue(new Error("onboarding unavailable"));
    mocks.invalidate.mockImplementation(() => { throw new Error("cache unavailable"); });
    expect(await confirmReceiptExpenseAction({ ...input, fromOnboarding: true })).toMatchObject({ ok: true, refreshPending: true });
    expect(mocks.confirm).toHaveBeenCalledOnce();
  });
  it("still returns a failure if the actual import fails", async () => {
    mocks.confirm.mockRejectedValue(new Error("Import misslyckades"));
    expect(await confirmReceiptExpenseAction(input)).toEqual({ ok: false, error: "Import misslyckades" });
    expect(mocks.profile).not.toHaveBeenCalled();
  });
});
