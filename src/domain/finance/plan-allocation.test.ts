import { describe, expect, it } from "vitest";
import { projectCashCoverage } from "./cash-coverage";
import {
  applyAllocateInMemory,
  type PlanPaymentAllocation,
} from "./plan-allocation";
import type { CanonicalTransaction, PlanItem } from "./types";

function bill(partial: Partial<PlanItem> = {}): PlanItem {
  return {
    id: "hyra",
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

function payment(
  partial: Partial<CanonicalTransaction> &
    Pick<CanonicalTransaction, "id" | "amountMinor">,
): CanonicalTransaction {
  return {
    userId: "u1",
    accountId: "bank",
    counterAccountId: null,
    direction: "debit",
    transactionType: "expense",
    currency: "THB",
    thbMinor: partial.thbMinor ?? partial.amountMinor,
    occurredAt: "2026-08-26T03:00:00.000Z",
    description: "Hyra",
    merchant: null,
    category: null,
    source: "sms",
    status: "confirmed",
    balanceAfterMinor: null,
    fingerprint: null,
    sourceObservationId: null,
    transferGroupId: null,
    planItemId: null,
    ledgerOrigin: "external",
    linkedPlanItemId: null,
    syncStatus: "synced",
    createdAt: "2026-08-26T03:00:00.000Z",
    updatedAt: "2026-08-26T03:00:00.000Z",
    ...partial,
  };
}

const accounts = [{ id: "bank", userId: "u1" }];
const ids = ["a", "b", "c", "d", "e"];
let idAt = 0;
function nextId() {
  return ids[idAt++] ?? `id-${idAt}`;
}

function allocate(
  item: PlanItem,
  tx: CanonicalTransaction,
  txs: CanonicalTransaction[],
  allocations: PlanPaymentAllocation[],
  clientMutationId?: string,
) {
  return applyAllocateInMemory({
    item,
    transaction: tx,
    transactions: txs,
    allocations,
    accounts,
    userId: "u1",
    nowIso: "2026-08-26T06:00:00.000Z",
    newId: nextId,
    clientMutationId,
  });
}

describe("plan payment allocations", () => {
  it("accepts 5k + 5k + 10k against a 20k bill and ignores a retry", () => {
    idAt = 0;
    const item = bill();
    const first = payment({ id: "p1", amountMinor: 5_000_00 });
    const second = payment({ id: "p2", amountMinor: 5_000_00 });
    const third = payment({ id: "p3", amountMinor: 10_000_00 });
    const txs = [first, second, third];
    const allocations: PlanPaymentAllocation[] = [];

    const one = allocate(item, first, txs, allocations, "mut-1");
    expect(one.ok).toBe(true);
    if (!one.ok) return;
    expect(one.allocatedCanonicalMinor).toBe(5_000_00);
    expect(one.remainingCanonicalMinor).toBe(15_000_00);
    expect(item.settledMinor).toBe(5_000_00);

    const two = allocate(item, second, txs, allocations, "mut-2");
    expect(two.ok).toBe(true);
    if (!two.ok) return;
    expect(two.remainingCanonicalMinor).toBe(10_000_00);

    const three = allocate(item, third, txs, allocations, "mut-3");
    expect(three.ok).toBe(true);
    if (!three.ok) return;
    expect(three.remainingCanonicalMinor).toBe(0);
    expect(item.settledMinor).toBe(20_000_00);
    expect(item.settledAt).toBeTruthy();
    expect(allocations).toHaveLength(3);

    const retry = allocate(item, third, txs, allocations, "mut-3");
    expect(retry.ok).toBe(true);
    if (!retry.ok) return;
    expect(retry.idempotent).toBe(true);
    expect(allocations).toHaveLength(3);

    const coverage = projectCashCoverage({
      planItems: [item],
      transactions: txs,
      monthKey: "2026-08",
      timeZone: "Asia/Bangkok",
      saldoMinor: 40_000_00,
    });
    expect(coverage.unpaidMinor).toBe(0);
  });

  it("keeps a partial synthetic and adds later external 5k + 10k", () => {
    idAt = 0;
    const item = bill({
      settledMinor: 5_000_00,
      remainingDueAt: "2026-08-28T12:00:00.000Z",
    });
    const synth = payment({
      id: "synth-5",
      amountMinor: 5_000_00,
      source: "manual",
      planItemId: "hyra",
      ledgerOrigin: "plan_settle",
    });
    const second = payment({ id: "p2", amountMinor: 5_000_00 });
    const third = payment({ id: "p3", amountMinor: 10_000_00 });
    const txs = [synth, second, third];
    const allocations: PlanPaymentAllocation[] = [];

    const two = allocate(item, second, txs, allocations, "mut-2");
    expect(two.ok).toBe(true);
    if (!two.ok) return;
    expect(two.voidedSyntheticIds).toEqual([]);
    expect(synth.status).toBe("confirmed");
    expect(item.settledMinor).toBe(10_000_00);
    expect(two.remainingCanonicalMinor).toBe(10_000_00);

    const three = allocate(item, third, txs, allocations, "mut-3");
    expect(three.ok).toBe(true);
    if (!three.ok) return;
    expect(three.voidedSyntheticIds).toEqual([]);
    expect(synth.status).toBe("confirmed");
    expect(item.settledMinor).toBe(20_000_00);
    expect(three.remainingCanonicalMinor).toBe(0);
  });

  it("voids a synthetic full settlement exactly once when the real SMS is linked", () => {
    idAt = 0;
    const item = bill({
      settledAt: "2026-08-25T12:00:00.000Z",
      settledMinor: 20_000_00,
    });
    const synth = payment({
      id: "synth",
      amountMinor: 20_000_00,
      source: "manual",
      planItemId: "hyra",
      ledgerOrigin: "plan_settle",
    });
    const real = payment({ id: "sms", amountMinor: 20_000_00 });
    const txs = [synth, real];
    const allocations: PlanPaymentAllocation[] = [];
    const first = allocate(item, real, txs, allocations, "link-real");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.voidedSyntheticIds).toEqual(["synth"]);
    expect(synth.status).toBe("voided");
    expect(allocations).toHaveLength(1);
    expect(item.settledMinor).toBe(20_000_00);

    const retry = allocate(item, real, txs, allocations, "link-real");
    expect(retry.ok).toBe(true);
    if (!retry.ok) return;
    expect(retry.idempotent).toBe(true);
    expect(retry.voidedSyntheticIds).toEqual([]);
    expect(txs.filter((row) => row.ledgerOrigin === "plan_settle")).toHaveLength(1);
    expect(txs.filter((row) => row.status === "confirmed")).toHaveLength(1);
  });

  it("rejects the wrong direction, wrong currency and over-allocation without voiding", () => {
    idAt = 0;
    const item = bill();
    const synth = payment({
      id: "synth",
      amountMinor: 20_000_00,
      source: "manual",
      planItemId: "hyra",
      ledgerOrigin: "plan_settle",
    });
    const income = payment({
      id: "in",
      amountMinor: 5_000_00,
      direction: "credit",
      transactionType: "income",
    });
    const sek = payment({
      id: "sek",
      amountMinor: 5_000_00,
      currency: "SEK",
      thbMinor: 17_500_00,
    });
    const tooBig = payment({ id: "big", amountMinor: 25_000_00 });
    const txs = [synth, income, sek, tooBig];
    const allocations: PlanPaymentAllocation[] = [];

    expect(allocate(item, income, txs, allocations).ok).toBe(false);
    expect(allocate(item, sek, txs, allocations).ok).toBe(false);
    const over = allocate(item, tooBig, txs, allocations);
    expect(over).toEqual({ ok: false, error: "over_allocation" });
    expect(synth.status).toBe("confirmed");
    expect(allocations).toHaveLength(0);
  });
});
