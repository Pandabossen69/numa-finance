import { describe, expect, it } from "vitest";
import {
  computeDiscretionarySpendingWindows,
  projectCashCoverage,
} from "./cash-coverage";
import { projectLivingBudget } from "./living-budget";
import { projectPayCycle } from "./pay-cycle";
import type { CanonicalTransaction } from "./types";
import {
  MONTHLY_SAVE_NAME,
  remainingOpenMinor,
  projectPlanForMonth,
  resolveAdditionalSettlement,
} from "./plan-months";
import type { PlanItem } from "./types";

/**
 * Canonical money vocabulary (P0):
 * - ACCOUNT BALANCE: checkpoints + ledger (not tested here)
 * - PLANNED INCOME: expected, not necessarily received
 * - UNPAID OBLIGATIONS: remainingOpenMinor of plan expenses
 * - PAID PLANNED EXPENSE: settles move cash via ledger; reservation shrinks
 * - DISCRETIONARY SPENDING: actual expense not already reserved
 * - AVAILABLE AFTER PLAN: income − unpaid obligations − savings
 * - KVAR / remaining free: available after plan − discretionary spending
 */

function item(
  partial: Partial<PlanItem> & Pick<PlanItem, "kind" | "amountMinor" | "name">,
): PlanItem {
  return {
    id: partial.id ?? crypto.randomUUID(),
    userId: "u1",
    name: partial.name,
    kind: partial.kind,
    amountMinor: partial.amountMinor,
    currency: "THB",
    cadence: partial.cadence ?? "monthly",
    nextDueAt: partial.nextDueAt ?? "2026-08-28T12:00:00.000Z",
    isActive: partial.isActive ?? true,
    settledAt: partial.settledAt ?? null,
    settledMinor: partial.settledMinor ?? null,
    remainingDueAt: partial.remainingDueAt ?? null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-08-01T00:00:00.000Z",
  };
}

const tz = "Asia/Bangkok";
/** After August funding wave has fully landed. */
const now = new Date("2026-08-26T05:00:00.000Z");

function fundedIncome(): PlanItem[] {
  return [
    item({
      id: "inc",
      name: "Lön",
      kind: "expected",
      amountMinor: 100_000_00,
      cadence: "income",
      nextDueAt: "2026-08-25T12:00:00.000Z",
    }),
    item({
      id: "inc-next",
      name: "Lön sep",
      kind: "expected",
      amountMinor: 100_000_00,
      cadence: "income",
      nextDueAt: "2026-09-25T12:00:00.000Z",
    }),
  ];
}

function rent(partial: Partial<PlanItem> = {}): PlanItem {
  return item({
    id: "rent",
    name: "Hyra",
    kind: "mandatory",
    amountMinor: 30_000_00,
    nextDueAt: "2026-08-28T12:00:00.000Z",
    ...partial,
  });
}

function remainingAfterPlan(items: PlanItem[], cycleSpendingMinor: number) {
  const cycle = projectPayCycle(items, now, tz);
  const living = projectLivingBudget({
    cycle,
    now,
    timeZone: tz,
    bankBalanceMinor: 100_000_00,
    cycleSpendingMinor,
    todaySpendingMinor: 0,
    fundingConfirmed: true,
  });
  return { cycle, living };
}

describe("financial truth — planned expense must not double-count", () => {
  it("TEST 1: unpaid rent reserves 30k; paying it keeps free at 70k", () => {
    const unpaid = [...fundedIncome(), rent()];
    const before = remainingAfterPlan(unpaid, 0);
    expect(before.cycle.expenseMinor).toBe(30_000_00);
    expect(before.cycle.freeToSpendMinor).toBe(70_000_00);
    expect(before.living.remainingFreeMinor).toBe(70_000_00);

    const paid = [
      ...fundedIncome(),
      rent({
        settledMinor: 30_000_00,
        settledAt: "2026-08-26T08:00:00.000Z",
        updatedAt: "2026-08-26T08:00:00.000Z",
      }),
    ];
    // Ledger booked the 30k settlement — that is actual cash out.
    const after = remainingAfterPlan(paid, 30_000_00);
    expect(remainingOpenMinor(paid[2]!)).toBe(0);
    expect(after.cycle.expenseMinor).toBe(0);
    expect(after.cycle.freeToSpendMinor).toBe(100_000_00);
    expect(after.living.remainingFreeMinor).toBe(70_000_00);
  });

  it("TEST 2: discretionary restaurant reduces free to 60k", () => {
    const items = [...fundedIncome(), rent()];
    const view = remainingAfterPlan(items, 10_000_00);
    expect(view.cycle.freeToSpendMinor).toBe(70_000_00);
    expect(view.living.remainingFreeMinor).toBe(60_000_00);
  });

  it("TEST 3: partial 10k keeps total burden at 30k (not 40k)", () => {
    const items = [
      ...fundedIncome(),
      rent({
        settledMinor: 10_000_00,
        remainingDueAt: "2026-08-28T12:00:00.000Z",
        updatedAt: "2026-08-26T09:00:00.000Z",
      }),
    ];
    expect(remainingOpenMinor(items[2]!)).toBe(20_000_00);
    const view = remainingAfterPlan(items, 10_000_00);
    expect(view.cycle.expenseMinor).toBe(20_000_00);
    expect(view.cycle.freeToSpendMinor).toBe(80_000_00);
    expect(view.living.remainingFreeMinor).toBe(70_000_00);
  });

  it("TEST 4: another 5k partial still totals exactly 30k burden", () => {
    const items = [
      ...fundedIncome(),
      rent({
        settledMinor: 15_000_00,
        remainingDueAt: "2026-08-28T12:00:00.000Z",
        updatedAt: "2026-08-26T10:00:00.000Z",
      }),
    ];
    expect(remainingOpenMinor(items[2]!)).toBe(15_000_00);
    const view = remainingAfterPlan(items, 15_000_00);
    expect(view.cycle.expenseMinor).toBe(15_000_00);
    expect(view.cycle.freeToSpendMinor).toBe(85_000_00);
    expect(view.living.remainingFreeMinor).toBe(70_000_00);
  });

  it("TEST 5: Hem cycle free and Plan month free agree on unpaid remainder", () => {
    const items = [
      ...fundedIncome(),
      rent({
        settledMinor: 10_000_00,
        remainingDueAt: "2026-08-28T12:00:00.000Z",
      }),
    ];
    const cycle = projectPayCycle(items, now, tz);
    const month = projectPlanForMonth(items, "2026-08", tz);
    expect(cycle.expenseMinor).toBe(20_000_00);
    expect(month.totalPlannedMinor).toBe(20_000_00);
    expect(cycle.freeToSpendMinor).toBe(month.freeToSpendMinor);
  });
});


describe("financial truth — Plan failure must not become zero", () => {
  it("TEST 6: Plan read failure is unavailable, never an empty plan", async () => {
    const { readFileSync } = await import("node:fs");
    const repo = readFileSync(
      new URL("../../lib/store/supabase-repository.ts", import.meta.url),
      "utf8",
    );
    const start = repo.indexOf("export const getTodaySnapshot");
    const end = repo.indexOf("export async function getUserProgress");
    const snapshotFn = repo.slice(start, end === -1 ? undefined : end);
    expect(snapshotFn).not.toMatch(
      /listPlanItems\(\)\.catch\(\s*\(\)\s*=>\s*\[\]/,
    );
    expect(snapshotFn).toMatch(/loadPlanItems:\s*listPlanItems/);
    expect(snapshotFn).toContain("financeRevision");
    expect(snapshotFn).toContain("verifiedAt");
  });
});

/** Live new-user audit — exact regression matrix from production blocker pass. */
describe("financial truth — live audit regression scenario", () => {
  const auditNow = new Date("2026-08-26T05:00:00.000Z");
  const bankStart = 50_000_00;
  const lunchMinor = 1_200_00;

  function auditItems(rentPartial: Partial<PlanItem> = {}): PlanItem[] {
    return [
      item({
        id: "inc-aug",
        name: "Lön",
        kind: "expected",
        amountMinor: 60_000_00,
        cadence: "income",
        nextDueAt: "2026-08-25T12:00:00.000Z",
        settledMinor: 60_000_00,
        settledAt: "2026-08-25T14:00:00.000Z",
      }),
      item({
        id: "inc-sep",
        name: "Lön sep",
        kind: "expected",
        amountMinor: 60_000_00,
        cadence: "income",
        nextDueAt: "2026-09-25T12:00:00.000Z",
      }),
      item({
        id: "rent",
        name: "Hyra",
        kind: "mandatory",
        amountMinor: 20_000_00,
        nextDueAt: "2026-08-28T12:00:00.000Z",
        ...rentPartial,
      }),
      item({
        id: "extra",
        name: "Extra",
        kind: "expected",
        amountMinor: 5_000_00,
        nextDueAt: "2026-08-30T12:00:00.000Z",
      }),
      item({
        id: "save",
        name: MONTHLY_SAVE_NAME,
        kind: "goal",
        amountMinor: 3_000_00,
        cadence: "monthly",
        nextDueAt: "2026-08-28T12:00:00.000Z",
      }),
    ];
  }

  function auditView(items: PlanItem[], cycleSpendingMinor: number) {
    const cycle = projectPayCycle(items, auditNow, tz);
    const living = projectLivingBudget({
      cycle,
      now: auditNow,
      timeZone: tz,
      bankBalanceMinor: bankStart,
      cycleSpendingMinor,
      todaySpendingMinor: 0,
      fundingConfirmed: true,
    });
    const month = projectPlanForMonth(items, "2026-08", tz);
    const coverage = projectCashCoverage({
      planItems: items,
      transactions: [],
      monthKey: "2026-08",
      timeZone: tz,
      saldoMinor: bankStart,
    });
    return { cycle, living, month, coverage };
  }

  it("flexible pool is 32k before discretionary; lunch leaves 30.8k", () => {
    const view = auditView(auditItems(), lunchMinor);
    expect(view.cycle.freeToSpendMinor).toBe(32_000_00);
    expect(view.living.remainingFreeMinor).toBe(30_800_00);
    expect(view.cycle.freeToSpendMinor).toBe(view.month.freeToSpendMinor);
  });

  it("partial rent 5k leaves 15k open; flexible stays 30.8k", () => {
    const partial = resolveAdditionalSettlement({
      plannedMinor: 20_000_00,
      alreadySettledMinor: 0,
      additionalMinor: 5_000_00,
    });
    expect(partial.ok).toBe(true);
    if (!partial.ok) return;

    const items = auditItems({
      settledMinor: partial.targetSettledMinor,
      remainingDueAt: "2026-08-28T12:00:00.000Z",
    });
    expect(remainingOpenMinor(items[2]!)).toBe(15_000_00);
    const cycleSpend = lunchMinor + 5_000_00;
    const view = auditView(items, cycleSpend);
    expect(view.cycle.expenseMinor).toBe(20_000_00); // 15k rent + 5k extra
    expect(view.living.remainingFreeMinor).toBe(30_800_00);
    expect(view.coverage.unpaidMinor).toBe(20_000_00);
  });

  it("final rent 15k completes; only 5k extra unpaid; flexible still 30.8k", () => {
    const items = auditItems({
      settledMinor: 20_000_00,
      settledAt: "2026-08-26T10:00:00.000Z",
    });
    const cycleSpend = lunchMinor + 20_000_00;
    const view = auditView(items, cycleSpend);
    expect(remainingOpenMinor(items[2]!)).toBe(0);
    expect(view.cycle.expenseMinor).toBe(5_000_00);
    expect(view.living.remainingFreeMinor).toBe(30_800_00);
    expect(view.coverage.unpaidMinor).toBe(5_000_00);
    expect(view.cycle.freeToSpendMinor).toBe(view.month.freeToSpendMinor);
  });

  it("amount above remaining rent is rejected", () => {
    const result = resolveAdditionalSettlement({
      plannedMinor: 20_000_00,
      alreadySettledMinor: 5_000_00,
      additionalMinor: 16_000_00,
    });
    expect(result.ok).toBe(false);
  });

  it("undo full settle restores 20k rent reservation", () => {
    const paid = auditItems({
      settledMinor: 20_000_00,
      settledAt: "2026-08-26T10:00:00.000Z",
    });
    const unpaid = auditItems();
    expect(remainingOpenMinor(paid[2]!)).toBe(0);
    expect(remainingOpenMinor(unpaid[2]!)).toBe(20_000_00);
    const afterUndo = auditView(unpaid, lunchMinor);
    expect(afterUndo.cycle.expenseMinor).toBe(25_000_00);
    expect(afterUndo.living.remainingFreeMinor).toBe(30_800_00);
  });

  it("bank rent without Betald does not consume flexible again", () => {
    const items = auditItems();
    const txs: CanonicalTransaction[] = [
      {
        id: "rent-sms",
        userId: "u1",
        accountId: "a1",
        counterAccountId: null,
        direction: "debit",
        transactionType: "expense",
        amountMinor: 20_000_00,
        currency: "THB",
        occurredAt: "2026-08-26T08:00:00.000Z",
        description: "Hyra",
        merchant: null,
        category: "Boende",
        source: "manual",
        status: "confirmed",
        balanceAfterMinor: null,
        fingerprint: null,
        sourceObservationId: null,
        planItemId: null,
        transferGroupId: null,
        syncStatus: "synced",
        createdAt: "2026-08-26T08:00:00.000Z",
        updatedAt: "2026-08-26T08:00:00.000Z",
      },
      {
        id: "lunch",
        userId: "u1",
        accountId: "a1",
        counterAccountId: null,
        direction: "debit",
        transactionType: "expense",
        amountMinor: lunchMinor,
        currency: "THB",
        occurredAt: "2026-08-26T09:00:00.000Z",
        description: "Lunch",
        merchant: null,
        category: "Mat",
        source: "manual",
        status: "confirmed",
        balanceAfterMinor: null,
        fingerprint: null,
        sourceObservationId: null,
        planItemId: null,
        transferGroupId: null,
        syncStatus: "synced",
        createdAt: "2026-08-26T09:00:00.000Z",
        updatedAt: "2026-08-26T09:00:00.000Z",
      },
    ];
    const cycle = projectPayCycle(items, auditNow, tz);
    const disc = computeDiscretionarySpendingWindows({
      transactions: txs,
      planItems: items,
      currency: "THB",
      now: auditNow,
      timeZone: tz,
      monthKey: "2026-08",
      cycleStartAt: cycle.startAt,
      cycleEndAt: cycle.endAt,
    });
    expect(disc.cycle.amountMinor).toBe(lunchMinor);
    const living = projectLivingBudget({
      cycle,
      now: auditNow,
      timeZone: tz,
      bankBalanceMinor: bankStart,
      cycleSpendingMinor: disc.cycle.amountMinor,
      todaySpendingMinor: disc.today.amountMinor,
      fundingConfirmed: true,
    });
    expect(living.remainingFreeMinor).toBe(30_800_00);
    const coverage = projectCashCoverage({
      planItems: items,
      transactions: txs,
      monthKey: "2026-08",
      timeZone: tz,
      saldoMinor: bankStart,
    });
    expect(coverage.unpaidMinor).toBe(5_000_00);
  });
});
