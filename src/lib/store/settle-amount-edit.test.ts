import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calculateAccountBalance,
  filterTransactionsAfterCheckpoint,
  projectCashCoverage,
  applyPlanItemEdits,
  type BalanceCheckpoint,
  type CanonicalTransaction,
  type PlanItem,
} from "@/domain/finance";
import { applySettleInMemory } from "./settle-atomic";

const OLD = 4_400_000;
const NEXT = 4_500_000;
const DELTA = 100_000;
const OPENING = 8_000_000;
const OPENING_AT = "2026-09-01T00:00:00.000Z";
const PAID_AT = "2026-09-10T08:00:00.000Z";
const RESAVED_AT = "2026-09-20T08:00:00.000Z";
const EDIT_AT = "2026-09-23T08:00:00.000Z";

function dator(partial: Partial<PlanItem> = {}): PlanItem {
  return {
    id: "dator",
    userId: "u1",
    name: "Dator",
    kind: "flexible",
    amountMinor: OLD,
    currency: "THB",
    cadence: "monthly",
    nextDueAt: "2026-09-15T12:00:00.000Z",
    isActive: true,
    settledAt: null,
    settledMinor: null,
    remainingDueAt: null,
    createdAt: OPENING_AT,
    updatedAt: OPENING_AT,
    ...partial,
  };
}

function checkpoint(balanceMinor: number, verifiedAt: string): BalanceCheckpoint {
  return {
    id: `cp-${verifiedAt}`,
    userId: "u1",
    accountId: "bank",
    balanceMinor,
    currency: "THB",
    thbMinor: balanceMinor,
    fxRate: 1,
    fxAsOf: verifiedAt,
    fxSource: "manual",
    verifiedAt,
    source: "manual",
    sourceObservationId: null,
    note: null,
    createdAt: verifiedAt,
  };
}

function confirmedSettle(txs: CanonicalTransaction[]): CanonicalTransaction[] {
  return txs.filter(
    (tx) => tx.ledgerOrigin === "plan_settle" && tx.status === "confirmed",
  );
}

function thbOf(txs: CanonicalTransaction[]): number {
  return txs.reduce((sum, tx) => sum + (tx.thbMinor ?? tx.amountMinor), 0);
}

function saldoAfter(
  txs: CanonicalTransaction[],
  verifiedAt: string,
  balanceMinor: number,
): number {
  const point = checkpoint(balanceMinor, verifiedAt);
  const money = calculateAccountBalance({
    checkpoint: point,
    transactionsAfterCheckpoint: filterTransactionsAfterCheckpoint(txs, point),
  });
  return money?.amountMinor ?? 0;
}

function overMinor(item: PlanItem, saldoMinor: number): number {
  return projectCashCoverage({
    planItems: [item],
    transactions: [],
    monthKey: "2026-09",
    timeZone: "Asia/Bangkok",
    saldoMinor,
  }).overMinor;
}

const account = { id: "bank", isDefault: true, currency: "THB" };

describe("Betald/Mottagen amount edit", () => {
  it("changes Över by the delta when a later checkpoint already contains the payment", () => {
    const item = dator();
    const txs: CanonicalTransaction[] = [];
    applySettleInMemory({
      item,
      transactions: txs,
      accounts: [account],
      settled: true,
      targetSettledMinor: OLD,
      remainingDueAt: null,
      nowIso: PAID_AT,
      newId: () => "synth-dator",
      userId: "u1",
      checkpoints: [{ accountId: "bank", verifiedAt: OPENING_AT }],
    });
    const original = confirmedSettle(txs)[0];
    expect(original?.amountMinor).toBe(OLD);

    const embedded = OPENING - OLD;
    const overBefore = overMinor(item, embedded);
    const edited = applyPlanItemEdits(item, { amountMinor: NEXT });
    item.amountMinor = edited.amountMinor;
    item.settledAt = edited.settledAt;
    item.settledMinor = edited.settledMinor;
    item.remainingDueAt = edited.remainingDueAt;

    const result = applySettleInMemory({
      item,
      transactions: txs,
      accounts: [account],
      settled: (item.settledMinor ?? 0) > 0,
      targetSettledMinor: item.settledMinor ?? 0,
      remainingDueAt: item.remainingDueAt ?? null,
      nowIso: EDIT_AT,
      newId: () => "synth-dator-delta",
      userId: "u1",
      checkpoints: [
        { accountId: "bank", verifiedAt: OPENING_AT },
        { accountId: "bank", verifiedAt: RESAVED_AT },
      ],
    });

    const live = confirmedSettle(txs);
    const frozen = live.filter((tx) => Date.parse(tx.occurredAt) < Date.parse(RESAVED_AT));
    const window = live.filter((tx) => Date.parse(tx.occurredAt) >= Date.parse(RESAVED_AT));
    expect(original?.status).toBe("confirmed");
    expect(thbOf(frozen)).toBe(OLD);
    expect(thbOf(window)).toBe(DELTA);
    expect(thbOf(live)).toBe(NEXT);
    expect(item.settledMinor).toBe(NEXT);
    expect(result.saldoDeltaMinor).toBe(-DELTA);

    const saldo = saldoAfter(txs, RESAVED_AT, embedded);
    expect(saldo - embedded).toBe(-DELTA);
    expect(overMinor(item, saldo) - overBefore).toBe(-DELTA);
    expect(
      projectCashCoverage({
        planItems: [item],
        transactions: [],
        monthKey: "2026-09",
        timeZone: "Asia/Bangkok",
        saldoMinor: saldo,
      }).unpaidMinor,
    ).toBe(0);
  });

  it("raises Mottagen by the delta only when the receipt is already in the checkpoint", () => {
    const item = dator({ cadence: "income", name: "Lön" });
    const txs: CanonicalTransaction[] = [];
    applySettleInMemory({
      item,
      transactions: txs,
      accounts: [account],
      settled: true,
      targetSettledMinor: OLD,
      remainingDueAt: null,
      nowIso: PAID_AT,
      newId: () => "synth-lon",
      userId: "u1",
      checkpoints: [{ accountId: "bank", verifiedAt: OPENING_AT }],
    });
    const embedded = OPENING + OLD;
    const overBefore = overMinor(item, embedded);
    const edited = applyPlanItemEdits(item, { amountMinor: NEXT });
    item.amountMinor = edited.amountMinor;
    item.settledAt = edited.settledAt;
    item.settledMinor = edited.settledMinor;
    applySettleInMemory({
      item,
      transactions: txs,
      accounts: [account],
      settled: true,
      targetSettledMinor: item.settledMinor ?? 0,
      remainingDueAt: null,
      nowIso: EDIT_AT,
      newId: () => "synth-lon-delta",
      userId: "u1",
      checkpoints: [
        { accountId: "bank", verifiedAt: OPENING_AT },
        { accountId: "bank", verifiedAt: RESAVED_AT },
      ],
    });
    const saldo = saldoAfter(txs, RESAVED_AT, embedded);
    expect(saldo - embedded).toBe(DELTA);
    expect(overMinor(item, saldo) - overBefore).toBe(DELTA);
    expect(thbOf(confirmedSettle(txs))).toBe(NEXT);
  });

  it("updates the open booking in place so Över moves by the delta and the payment keeps its time", () => {
    const item = dator();
    const txs: CanonicalTransaction[] = [];
    applySettleInMemory({
      item,
      transactions: txs,
      accounts: [account],
      settled: true,
      targetSettledMinor: OLD,
      remainingDueAt: null,
      nowIso: PAID_AT,
      newId: () => "synth-open",
      userId: "u1",
      checkpoints: [{ accountId: "bank", verifiedAt: OPENING_AT }],
    });
    const overBefore = overMinor(item, OPENING - OLD);
    const edited = applyPlanItemEdits(item, { amountMinor: NEXT });
    item.amountMinor = edited.amountMinor;
    item.settledMinor = edited.settledMinor;
    item.settledAt = edited.settledAt;
    applySettleInMemory({
      item,
      transactions: txs,
      accounts: [account],
      settled: true,
      targetSettledMinor: NEXT,
      remainingDueAt: null,
      nowIso: EDIT_AT,
      newId: () => "should-not-insert",
      userId: "u1",
      checkpoints: [{ accountId: "bank", verifiedAt: OPENING_AT }],
    });
    const live = confirmedSettle(txs);
    expect(live).toHaveLength(1);
    expect(live[0]?.id).toBe("synth-open");
    expect(live[0]?.occurredAt).toBe(PAID_AT);
    expect(live[0]?.amountMinor).toBe(NEXT);
    const saldo = saldoAfter(txs, OPENING_AT, OPENING);
    expect(saldo - (OPENING - OLD)).toBe(-DELTA);
    expect(overMinor(item, saldo) - overBefore).toBe(-DELTA);
  });
});

describe("settle amount migration", () => {
  const sql = readFileSync(
    new URL(
      "../../../supabase/migrations/20260923100000_settle_amount_edit_delta.sql",
      import.meta.url,
    ),
    "utf8",
  );

  it("posts only the open-window delta and drops the one-row settle lock", () => {
    expect(sql).toContain("drop index if exists numa.numa_transactions_one_settle_per_plan");
    expect(sql).toContain("occurred_at < v_checkpoint_at");
    expect(sql).toContain("v_desired_window := v_synth_target - v_frozen_thb");
    expect(sql).toContain("not v_keeper_matches");
    expect(sql).not.toContain("set status = 'voided', updated_at = v_now\n  where user_id = v_uid\n    and plan_item_id = v_item.id\n    and ledger_origin = 'plan_settle'\n    and status = 'confirmed';");
  });
});
