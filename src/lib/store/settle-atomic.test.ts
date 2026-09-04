import { describe, expect, it } from "vitest";
import { applySettleInMemory } from "./settle-atomic";
import type { CanonicalTransaction, PlanItem } from "@/domain/finance";

function plan(partial: Partial<PlanItem> = {}): PlanItem {
  return {
    id: "rent",
    userId: "u1",
    name: "Hyra",
    kind: "mandatory",
    amountMinor: 20_000_00,
    currency: "THB",
    cadence: "monthly",
    nextDueAt: "2026-08-28T12:00:00.000Z",
    isActive: true,
    settledAt: null,
    settledMinor: null,
    remainingDueAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...partial,
  };
}

const account = { id: "bank", isDefault: true, currency: "THB" };

describe("atomic in-memory settlement", () => {
  it("writes flags and one synthetic row together", () => {
    const item = plan();
    const txs: CanonicalTransaction[] = [];
    const result = applySettleInMemory({
      item,
      transactions: txs,
      accounts: [account],
      settled: true,
      targetSettledMinor: 5_000_00,
      remainingDueAt: "2026-08-28T12:00:00.000Z",
      nowIso: "2026-08-26T06:00:00.000Z",
      newId: () => "synth-1",
      userId: "u1",
    });
    expect(result.item.settledMinor).toBe(5_000_00);
    expect(result.item.settledAt).toBeNull();
    expect(result.bookedMinor).toBe(5_000_00);
    expect(result.saldoDeltaMinor).toBe(-5_000_00);
    expect(txs).toHaveLength(1);
    expect(txs[0]!.ledgerOrigin).toBe("plan_settle");
    expect(txs[0]!.planItemId).toBe("rent");
    expect(txs[0]!.linkedPlanItemId).toBeNull();
  });

  it("full settle then unsettle voids the synthetic and clears flags", () => {
    const item = plan();
    const txs: CanonicalTransaction[] = [];
    applySettleInMemory({
      item,
      transactions: txs,
      accounts: [account],
      settled: true,
      targetSettledMinor: 20_000_00,
      remainingDueAt: null,
      nowIso: "2026-08-26T06:00:00.000Z",
      newId: () => "synth-full",
      userId: "u1",
    });
    const undone = applySettleInMemory({
      item,
      transactions: txs,
      accounts: [account],
      settled: false,
      targetSettledMinor: 0,
      remainingDueAt: null,
      nowIso: "2026-08-26T07:00:00.000Z",
      newId: () => "unused",
      userId: "u1",
    });
    expect(undone.item.settledMinor).toBeNull();
    expect(undone.saldoDeltaMinor).toBe(20_000_00);
    expect(txs.filter((tx) => tx.status === "confirmed")).toHaveLength(0);
    expect(txs.filter((tx) => tx.status === "voided")).toHaveLength(1);
  });

  it("does not write a synthetic when an external row is already linked", () => {
    const item = plan();
    const txs: CanonicalTransaction[] = [
      {
        id: "bank-pay",
        userId: "u1",
        accountId: "bank",
        counterAccountId: null,
        direction: "debit",
        transactionType: "expense",
        amountMinor: 20_000_00,
        currency: "THB",
        occurredAt: "2026-08-26T03:00:00.000Z",
        description: "Hyra",
        merchant: null,
        category: null,
        source: "screenshot",
        status: "confirmed",
        balanceAfterMinor: null,
        fingerprint: "fp",
        sourceObservationId: null,
        transferGroupId: null,
        planItemId: null,
        ledgerOrigin: "external",
        linkedPlanItemId: "rent",
        syncStatus: "synced",
        createdAt: "2026-08-26T03:00:00.000Z",
        updatedAt: "2026-08-26T03:00:00.000Z",
      },
    ];
    const result = applySettleInMemory({
      item,
      transactions: txs,
      accounts: [account],
      settled: true,
      targetSettledMinor: 20_000_00,
      remainingDueAt: null,
      nowIso: "2026-08-26T06:00:00.000Z",
      newId: () => "should-not-exist",
      userId: "u1",
    });
    expect(result.skippedBecauseFunded).toBe(true);
    expect(result.bookedMinor).toBe(0);
    expect(txs.filter((tx) => tx.ledgerOrigin === "plan_settle")).toHaveLength(0);
    expect(item.settledMinor).toBe(20_000_00);
  });

  it("is a no-op when already at the target", () => {
    const item = plan({
      settledMinor: 5_000_00,
      remainingDueAt: "2026-08-28T12:00:00.000Z",
    });
    const txs: CanonicalTransaction[] = [];
    const result = applySettleInMemory({
      item,
      transactions: txs,
      accounts: [account],
      settled: true,
      targetSettledMinor: 5_000_00,
      remainingDueAt: "2026-08-28T12:00:00.000Z",
      nowIso: "2026-08-26T06:00:00.000Z",
      newId: () => "x",
      userId: "u1",
    });
    expect(result.idempotent).toBe(true);
    expect(txs).toHaveLength(0);
  });
});
