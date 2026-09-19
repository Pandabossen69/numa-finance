import { describe, expect, it } from "vitest";
import {
  MONTHLY_SAVE_NAME,
  projectLivingBudget,
  projectPayCycle,
  type PlanItem,
} from "@/domain/finance";
import { applyMonthSavings } from "@/features/plan/optimistic";
import { previewMonthSavings, savingsPreviewLineSv } from "./savings-preview";

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
    nextDueAt: partial.nextDueAt ?? "2026-09-15T12:00:00.000Z",
    isActive: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

const tz = "Asia/Bangkok";
const now = new Date("2026-09-19T03:00:00.000Z");

function previewOf(
  items: PlanItem[],
  opts: {
    monthKey?: string;
    draftMinor: number;
    currentMinor: number;
    saldoMinor: number;
  },
) {
  return previewMonthSavings({
    items,
    monthKey: opts.monthKey ?? "2026-09",
    draftMinor: opts.draftMinor,
    currentMinor: opts.currentMinor,
    currency: "THB",
    timeZone: tz,
    ledgerTransactions: [],
    saldoMinor: opts.saldoMinor,
    cycleSpendingMinor: 0,
    todaySpendingMinor: 0,
    fundingConfirmed: true,
    now,
  });
}

function writePathLiving(items: PlanItem[], saldoMinor: number) {
  const cycle = projectPayCycle(items, now, tz);
  return projectLivingBudget({
    cycle,
    now,
    timeZone: tz,
    bankBalanceMinor: saldoMinor,
    cycleSpendingMinor: 0,
    todaySpendingMinor: 0,
    fundingConfirmed: true,
  });
}

describe("previewMonthSavings", () => {
  it("shows Över dropping by the draft avsättning before save", () => {
    const items = [
      item({
        name: "Hyra",
        kind: "mandatory",
        amountMinor: 10_000_00,
        nextDueAt: "2026-09-05T12:00:00.000Z",
      }),
    ];
    const preview = previewOf(items, {
      draftMinor: 15_000_00,
      currentMinor: 0,
      saldoMinor: 50_000_00,
    });
    expect(preview).not.toBeNull();
    expect(preview!.overTo).toBe(25_000_00);
    expect(preview!.overFrom).toBe(40_000_00);
  });

  it("returns null when the draft matches the saved amount", () => {
    expect(
      previewOf([], {
        draftMinor: 0,
        currentMinor: 0,
        saldoMinor: 10_000_00,
      }),
    ).toBeNull();
  });

  it("mirrors write-path Kvar idag and dagsbudget when cash-path living moves", () => {
    const items = [
      item({
        name: "Lön aug",
        kind: "expected",
        amountMinor: 40_000_00,
        cadence: "income",
        nextDueAt: "2026-08-25T12:00:00.000Z",
      }),
      item({
        name: "Lön sep",
        kind: "expected",
        amountMinor: 40_000_00,
        cadence: "income",
        nextDueAt: "2026-09-25T12:00:00.000Z",
      }),
    ];
    const preview = previewOf(items, {
      draftMinor: 15_000_00,
      currentMinor: 0,
      saldoMinor: 20_000_00,
    });
    expect(preview).not.toBeNull();
    const applied = applyMonthSavings(items, "2026-09", 15_000_00, "THB", tz);
    const from = writePathLiving(items, 20_000_00);
    const to = writePathLiving(applied.items, 20_000_00);
    expect(preview!.dayBudgetFrom).toBe(from.dayBudgetMinor);
    expect(preview!.dayBudgetTo).toBe(to.dayBudgetMinor);
    expect(preview!.remainingTodayFrom).toBe(from.remainingTodayMinor);
    expect(preview!.remainingTodayTo).toBe(to.remainingTodayMinor);
    expect(preview!.dayBudgetTo).not.toBe(preview!.dayBudgetFrom);
    expect(preview!.remainingTodayTo).not.toBe(preview!.remainingTodayFrom);
    const line = savingsPreviewLineSv(preview!);
    expect(line).toContain("Kvar idag");
    expect(line).toContain("Dagsbudget");
    expect(line).toContain("Kvar i perioden");
  });

  it("always prints Hem Kvar/dagsbudget for the Qualityltf 275,12 write path", () => {
    const items = [
      item({
        name: "Lön aug",
        kind: "expected",
        amountMinor: 40_000_00,
        cadence: "income",
        nextDueAt: "2026-08-25T12:00:00.000Z",
      }),
      item({
        name: "Lön sep",
        kind: "expected",
        amountMinor: 40_000_00,
        cadence: "income",
        nextDueAt: "2026-09-25T12:00:00.000Z",
      }),
      item({
        name: MONTHLY_SAVE_NAME,
        kind: "goal",
        amountMinor: 15_000_00,
        cadence: "savings",
        nextDueAt: "2026-09-20T12:00:00.000Z",
      }),
    ];
    const preview = previewOf(items, {
      draftMinor: 20_000_00,
      currentMinor: 15_000_00,
      saldoMinor: 3_421_95,
    });
    expect(preview).not.toBeNull();
    const applied = applyMonthSavings(items, "2026-09", 20_000_00, "THB", tz);
    const from = writePathLiving(items, 3_421_95);
    const to = writePathLiving(applied.items, 3_421_95);
    expect(preview!.dayBudgetFrom).toBe(from.dayBudgetMinor);
    expect(preview!.dayBudgetTo).toBe(to.dayBudgetMinor);
    expect(preview!.remainingTodayFrom).toBe(from.remainingTodayMinor);
    expect(preview!.remainingTodayTo).toBe(to.remainingTodayMinor);
    expect(preview!.overTo).toBe(preview!.overFrom - 5_000_00);
    expect(preview!.dayBudgetTo).not.toBe(preview!.dayBudgetFrom);
    expect(preview!.remainingTodayTo).not.toBe(preview!.remainingTodayFrom);
    expect(preview!.remainingFreeTo).toBeLessThan(preview!.remainingFreeFrom);
    const line = savingsPreviewLineSv(preview!);
    expect(line).toContain("Kvar idag");
    expect(line).toContain("Dagsbudget");
    expect(line).toMatch(/Kvar idag .+\u2192/);
    expect(line).toMatch(/Dagsbudget .+\u2192/);
    expect(line.startsWith("Över ")).toBe(true);
  });
});

describe("savingsPreviewLineSv", () => {
  it("never hides Kvar idag or dagsbudget when the write path holds them still", () => {
    const line = savingsPreviewLineSv({
      overFrom: 90_000_00,
      overTo: 85_000_00,
      remainingTodayFrom: 275_12,
      remainingTodayTo: 275_12,
      remainingFreeFrom: 1_650_75,
      remainingFreeTo: 1_650_75,
      dayBudgetFrom: 275_12,
      dayBudgetTo: 275_12,
    });
    expect(line).toContain("Över 90");
    expect(line).toContain("→ 85");
    expect(line).toContain("Kvar idag 275,12 → 275,12");
    expect(line).toContain("Dagsbudget 275,12 → 275,12");
    expect(line).toContain("Kvar i perioden 1");
    expect(line).toContain("650,75 → 1");
  });
});
