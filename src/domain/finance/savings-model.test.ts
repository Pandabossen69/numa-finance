import { describe, expect, it } from "vitest";
import {
  cashOverMinor,
  priorPlanSavingsMinor,
  projectCashCoverage,
  projectPlanForMonth,
  savingsByMonthKeys,
} from "@/domain/finance";
import type { PlanItem } from "@/domain/finance";

const tz = "Asia/Bangkok";

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
    nextDueAt: partial.nextDueAt ?? null,
    isActive: partial.isActive ?? true,
    settledAt: partial.settledAt ?? null,
    settledMinor: partial.settledMinor ?? null,
    remainingDueAt: partial.remainingDueAt ?? null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-09-01T00:00:00.000Z",
  };
}

const sepSave = item({
  id: "save-sep",
  name: "Spara denna månad",
  kind: "goal",
  amountMinor: 15_000_00,
  cadence: "savings",
  nextDueAt: "2026-09-15T12:00:00.000Z",
});
const oktSave = item({
  id: "save-okt",
  name: "Spara denna månad",
  kind: "goal",
  amountMinor: 15_000_00,
  cadence: "savings",
  nextDueAt: "2026-10-15T12:00:00.000Z",
  updatedAt: "2026-09-18T00:00:00.000Z",
});

describe("Spec O savings piles — 15k sep vs 30k okt", () => {
  it("does not call sep+okt 30k «sparat» on oktober — prior is 15k, this month is 15k", () => {
    const items = [sepSave, oktSave];
    const sep = projectCashCoverage({
      planItems: items,
      transactions: [],
      monthKey: "2026-09",
      timeZone: tz,
      saldoMinor: 80_000_00,
    });
    const okt = projectCashCoverage({
      planItems: items,
      transactions: [],
      monthKey: "2026-10",
      timeZone: tz,
      saldoMinor: 80_000_00,
    });

    expect(sep.savingsThisMonthMinor).toBe(15_000_00);
    expect(sep.savingsPriorMinor).toBe(0);
    expect(sep.reservedSavingsMinor).toBe(15_000_00);

    expect(okt.savingsThisMonthMinor).toBe(15_000_00);
    expect(okt.savingsPriorMinor).toBe(15_000_00);
    expect(okt.reservedSavingsMinor).toBe(30_000_00);
    expect(priorPlanSavingsMinor(items, "2026-10", tz)).toBe(15_000_00);
    // The 30k is sep+okt reserved, not a second copy of september.
    expect(okt.savingsPriorMinor).not.toBe(okt.reservedSavingsMinor);
  });

  it("moves X from Över into sparat so Plan + sparande stays the same", () => {
    const bills = [
      item({
        id: "hyra",
        name: "Hyra",
        kind: "mandatory",
        amountMinor: 10_000_00,
        nextDueAt: "2026-09-05T12:00:00.000Z",
      }),
    ];
    const before = projectCashCoverage({
      planItems: bills,
      transactions: [],
      monthKey: "2026-09",
      timeZone: tz,
      saldoMinor: 50_000_00,
    });
    expect(before.overMinor).toBe(40_000_00);
    expect(before.reservedSavingsMinor).toBe(0);

    const after = projectCashCoverage({
      planItems: [...bills, sepSave],
      transactions: [],
      monthKey: "2026-09",
      timeZone: tz,
      saldoMinor: 50_000_00,
    });
    expect(after.unpaidMinor).toBe(10_000_00);
    expect(after.overMinor).toBe(25_000_00);
    expect(after.overMinor).toBe(before.overMinor - 15_000_00);
    expect(after.overMinor + after.reservedSavingsMinor).toBe(before.overMinor);
  });

  it("nollställ of this month restores Över and leaves earlier sparat", () => {
    const both = projectCashCoverage({
      planItems: [sepSave, oktSave],
      transactions: [],
      monthKey: "2026-10",
      timeZone: tz,
      saldoMinor: 50_000_00,
    });
    const cleared = projectCashCoverage({
      planItems: [sepSave],
      transactions: [],
      monthKey: "2026-10",
      timeZone: tz,
      saldoMinor: 50_000_00,
    });
    expect(cleared.savingsThisMonthMinor).toBe(0);
    expect(cleared.savingsPriorMinor).toBe(15_000_00);
    expect(cleared.overMinor).toBe(both.overMinor + 15_000_00);
    expect(projectPlanForMonth([sepSave], "2026-10", tz).savingsMinor).toBe(0);
  });

  it("walks savings-by-month once and keeps latest row per month", () => {
    const stale = item({
      id: "save-sep-old",
      name: "Spara denna månad",
      kind: "goal",
      amountMinor: 3_000_00,
      cadence: "savings",
      nextDueAt: "2026-09-15T12:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    });
    const byMonth = savingsByMonthKeys(
      [stale, sepSave, oktSave],
      ["2026-09", "2026-10"],
      tz,
    );
    expect(byMonth["2026-09"]).toBe(15_000_00);
    expect(byMonth["2026-10"]).toBe(15_000_00);
  });
});

describe("cashOverMinor", () => {
  it("subtracts reserved savings from the cash stack", () => {
    expect(
      cashOverMinor({
        saldoMinor: 20_000_00,
        incomingMinor: 0,
        unpaidMinor: 8_000_00,
        reservedSavingsMinor: 25_000_00,
      }),
    ).toBe(-13_000_00);
  });
});
