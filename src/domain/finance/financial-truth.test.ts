import { describe, expect, it } from "vitest";
import { projectLivingBudget } from "./living-budget";
import { projectPayCycle } from "./pay-cycle";
import { remainingOpenMinor, projectPlanForMonth } from "./plan-months";
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
