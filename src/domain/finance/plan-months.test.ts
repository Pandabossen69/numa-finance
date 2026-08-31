import { describe, expect, it } from "vitest";
import type { PlanItem } from "./types";
import {
  applyPlanItemEdits,
  countsTowardCashMinor,
  importableFixedExpenses,
  isPlanPartiallySettled,
  isPlanSettled,
  isRecurringMonthly,
  planListStatus,
  planRowView,
  planPartialBreakdown,
  planRowHeroMinor,
  previewPartialRemaining,
  sortPlanRowsForList,
  remainingDueIso,
  remainingOpenMinor,
  settledAmountMinor,
  sumCountsTowardCashMinor,
  perDayBudgetMinor,
  projectPlanForMonth,
  cumulativePlanSavingsMinor,
  rollDueDateForward,
  spendDaysForMonth,
  withRolledMonthlyDues,
  yearMonthKeys,
  visibleMonthKeysForYear,
} from "./plan-months";
import { NEXT_INCOME_NAME } from "./plan-totals";

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
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("plan-months", () => {
  it("treats mandatory as recurring monthly", () => {
    expect(
      isRecurringMonthly(
        item({ name: "Hyra", kind: "mandatory", amountMinor: 100_00 }),
      ),
    ).toBe(true);
  });

  it("keeps fixed expenses in the month they were saved", () => {
    const items = [
      item({
        name: "Hyra",
        kind: "mandatory",
        amountMinor: 15_000_00,
        nextDueAt: "2026-08-01T00:00:00.000Z",
      }),
      item({
        name: "Engång",
        kind: "flexible",
        amountMinor: 500_00,
        cadence: "once",
        nextDueAt: "2026-08-15T00:00:00.000Z",
      }),
      item({
        name: "Lön",
        kind: "expected",
        amountMinor: 40_000_00,
        cadence: "income",
        nextDueAt: "2026-08-15T12:00:00.000Z",
      }),
      item({
        name: "Provision",
        kind: "expected",
        amountMinor: 5_000_00,
        cadence: "income",
        nextDueAt: "2026-09-15T12:00:00.000Z",
      }),
    ];

    const aug = projectPlanForMonth(items, "2026-08", "UTC");
    const sep = projectPlanForMonth(items, "2026-09", "UTC");

    expect(aug.items.map((i) => i.name)).toEqual(["Hyra", "Engång"]);
    expect(aug.fixedItems.map((i) => i.name)).toEqual(["Hyra"]);
    expect(aug.extraItems.map((i) => i.name)).toEqual(["Engång"]);
    expect(aug.extraMinor).toBe(500_00);
    expect(aug.incomes.map((i) => i.name)).toEqual(["Lön"]);
    expect(aug.incomeMinor).toBe(40_000_00);
    expect(aug.savingsMinor).toBe(0);
    expect(aug.freeToSpendMinor).toBe(40_000_00 - aug.totalPlannedMinor);
    expect(sep.items.map((i) => i.name)).toEqual([]);
    expect(sep.fixedItems).toEqual([]);
    expect(sep.extraItems).toEqual([]);
    expect(sep.incomes.map((i) => i.name)).toEqual(["Provision"]);
    expect(sep.reservedMinor).toBe(0);
  });

  it("does not let a new September fixed expense leak into August", () => {
    const items = [
      item({
        name: "Hyra",
        kind: "mandatory",
        amountMinor: 15_000_00,
        nextDueAt: "2026-08-01T12:00:00.000Z",
      }),
      item({
        name: "Spotify",
        kind: "mandatory",
        amountMinor: 119_00,
        nextDueAt: "2026-09-01T12:00:00.000Z",
      }),
    ];
    const aug = projectPlanForMonth(items, "2026-08", "UTC");
    const sep = projectPlanForMonth(items, "2026-09", "UTC");
    expect(aug.fixedItems.map((i) => i.name)).toEqual(["Hyra"]);
    expect(aug.fixedMinor).toBe(15_000_00);
    expect(sep.fixedItems.map((i) => i.name)).toEqual(["Spotify"]);
    expect(sep.fixedMinor).toBe(119_00);
  });

  it("lists previous-month fixed expenses that the target month is missing", () => {
    const hyraAug = item({
      name: "Hyra",
      kind: "mandatory",
      amountMinor: 15_000_00,
      nextDueAt: "2026-08-01T12:00:00.000Z",
    });
    const elAug = item({
      name: "El",
      kind: "mandatory",
      amountMinor: 800_00,
      nextDueAt: "2026-08-12T12:00:00.000Z",
    });
    const hyraSep = item({
      name: " hyra ",
      kind: "mandatory",
      amountMinor: 15_000_00,
      nextDueAt: "2026-09-01T12:00:00.000Z",
    });
    const importable = importableFixedExpenses({
      items: [hyraAug, elAug, hyraSep],
      fromMonthKey: "2026-08",
      toMonthKey: "2026-09",
      timeZone: "UTC",
    });
    expect(importable.map((i) => i.name)).toEqual(["El"]);
  });

  it("does not treat once cadence as recurring monthly", () => {
    expect(
      isRecurringMonthly(
        item({
          name: "Lån",
          kind: "expected",
          amountMinor: 10_000_00,
          cadence: "once",
          nextDueAt: "2026-09-10T12:00:00.000Z",
        }),
      ),
    ).toBe(false);
  });

  it("applies month savings only to that month", () => {
    const items = [
      item({
        name: "Hyra",
        kind: "mandatory",
        amountMinor: 10_000_00,
        nextDueAt: "2026-08-01T12:00:00.000Z",
      }),
      item({
        name: "Lön",
        kind: "expected",
        amountMinor: 40_000_00,
        cadence: "income",
        nextDueAt: "2026-08-15T12:00:00.000Z",
      }),
      item({
        name: "Spara denna månad",
        kind: "goal",
        amountMinor: 5_000_00,
        cadence: "savings",
        nextDueAt: "2026-08-15T12:00:00.000Z",
      }),
    ];
    const aug = projectPlanForMonth(items, "2026-08", "UTC");
    const sep = projectPlanForMonth(items, "2026-09", "UTC");
    expect(aug.savingsMinor).toBe(5_000_00);
    expect(aug.freeToSpendMinor).toBe(25_000_00);
    expect(sep.savingsMinor).toBe(0);
    expect(perDayBudgetMinor(25_000_00, 10)).toBe(2_500_00);
    expect(cumulativePlanSavingsMinor(items, "2026-08", "UTC")).toBe(5_000_00);
    expect(cumulativePlanSavingsMinor(items, "2026-09", "UTC")).toBe(5_000_00);

    const withSeptember = [
      ...items,
      item({
        name: "Spara denna månad",
        kind: "goal",
        amountMinor: 3_000_00,
        cadence: "savings",
        nextDueAt: "2026-09-15T12:00:00.000Z",
      }),
    ];
    expect(cumulativePlanSavingsMinor(withSeptember, "2026-08", "UTC")).toBe(
      5_000_00,
    );
    expect(cumulativePlanSavingsMinor(withSeptember, "2026-09", "UTC")).toBe(
      8_000_00,
    );
  });

  it("keeps Hem/Plan card math identical for a live month", () => {
    const items = [
      item({
        name: "Hyra",
        kind: "mandatory",
        amountMinor: 12_000_00,
        nextDueAt: "2026-08-01T12:00:00.000Z",
      }),
      item({
        name: "Netflix",
        kind: "mandatory",
        amountMinor: 199_00,
        nextDueAt: "2026-08-15T12:00:00.000Z",
      }),
      item({
        name: "Buffert",
        kind: "buffer",
        amountMinor: 2_000_00,
        nextDueAt: "2026-08-01T12:00:00.000Z",
      }),
      item({
        name: "Lön",
        kind: "expected",
        amountMinor: 45_000_00,
        cadence: "income",
        nextDueAt: "2026-08-15T12:00:00.000Z",
      }),
      item({
        name: "Spara denna månad",
        kind: "goal",
        amountMinor: 5_000_00,
        cadence: "savings",
        nextDueAt: "2026-08-15T12:00:00.000Z",
      }),
    ];
    const tz = "Asia/Bangkok";
    const monthKey = "2026-08";
    const p = projectPlanForMonth(items, monthKey, tz);

    // Cards: Intäkter / Utgifter / Sparande / Fritt / Per dag
    expect(p.incomeMinor).toBe(45_000_00);
    expect(p.totalPlannedMinor).toBe(12_000_00 + 199_00 + 2_000_00);
    expect(p.savingsMinor).toBe(5_000_00);
    expect(p.freeToSpendMinor).toBe(
      p.incomeMinor - p.totalPlannedMinor - p.savingsMinor,
    );
    expect(p.freeToSpendMinor).toBe(25_801_00);

    const days = spendDaysForMonth(
      monthKey,
      new Date("2026-08-11T10:00:00.000Z"),
      tz,
    );
    expect(days).toBe(21); // 11..31 incl.
    expect(perDayBudgetMinor(p.freeToSpendMinor, days)).toBe(
      Math.floor(25_801_00 / 21),
    );
  });

  it("does not treat planned income as recurring monthly", () => {
    expect(
      isRecurringMonthly(
        item({
          name: "Trukks",
          kind: "expected",
          amountMinor: 52_000_00,
          cadence: "income",
        }),
      ),
    ).toBe(false);
  });

  it("does not roll overdue fixed expenses out of their month", () => {
    const now = new Date("2026-08-11T03:00:00.000Z");
    const overdue = item({
      name: "Netflix",
      kind: "mandatory",
      amountMinor: 199_00,
      nextDueAt: "2026-06-01T00:00:00.000Z",
    });
    const { changed, items } = withRolledMonthlyDues([overdue], now);
    expect(changed).toHaveLength(0);
    expect(items[0]!.nextDueAt).toBe("2026-06-01T00:00:00.000Z");
  });

  it("still rolls the next-income pointer forward", () => {
    const now = new Date("2026-08-11T03:00:00.000Z");
    const pointer = item({
      name: NEXT_INCOME_NAME,
      kind: "expected",
      amountMinor: 0,
      nextDueAt: "2026-06-01T00:00:00.000Z",
    });
    const { changed, items } = withRolledMonthlyDues([pointer], now);
    expect(changed).toHaveLength(1);
    expect(items[0]!.nextDueAt).toBe(rollDueDateForward(pointer.nextDueAt!, now));
  });

  it("lists all twelve months for a year", () => {
    expect(yearMonthKeys(2027)).toEqual([
      "2027-01",
      "2027-02",
      "2027-03",
      "2027-04",
      "2027-05",
      "2027-06",
      "2027-07",
      "2027-08",
      "2027-09",
      "2027-10",
      "2027-11",
      "2027-12",
    ]);
  });

  it("lists January–December for 2026 so earlier months are browsable", () => {
    expect(visibleMonthKeysForYear(2026)[0]).toBe("2026-01");
    expect(visibleMonthKeysForYear(2026)).toHaveLength(12);
    expect(visibleMonthKeysForYear(2026)).toContain("2026-07");
    expect(visibleMonthKeysForYear(2026)).toContain("2026-08");
    expect(visibleMonthKeysForYear(2027)[0]).toBe("2027-01");
    expect(visibleMonthKeysForYear(2027)).toHaveLength(12);
    expect(visibleMonthKeysForYear(2025)).toHaveLength(12);
  });

  it("sorts open, then Delvis, then Betald — paid always last", () => {
    const paid = item({
      name: "GHK-Cu",
      kind: "mandatory",
      amountMinor: 1290_00,
      settledAt: "2026-08-27T12:00:00.000Z",
    });
    const openA = item({
      name: "Chatgpt",
      kind: "mandatory",
      amountMinor: 650_00,
    });
    const openB = item({
      name: "Cursor",
      kind: "mandatory",
      amountMinor: 3500_00,
    });
    const partial = item({
      name: "Aylis/Unseen",
      kind: "mandatory",
      amountMinor: 26000_00,
      settledMinor: 2000_00,
    });
    const sorted = sortPlanRowsForList([paid, openA, openB, partial]);
    expect(sorted.map((row) => row.name)).toEqual([
      "Chatgpt",
      "Cursor",
      "Aylis/Unseen",
      "GHK-Cu",
    ]);
    expect(planListStatus(partial)).toBe("partial");
    expect(planListStatus(paid)).toBe("settled");
  });

  it("never treats a ledger match as Betald — only the user's own tap counts", () => {
    // Hugo never tapped these. A nearby ledger transaction must not paint
    // them Betald/Mottagen, sink them in the list, or claim they are settled.
    const loan = item({
      name: "Pappa",
      kind: "mandatory",
      amountMinor: 15000_00,
    });
    const websiteIncome = item({
      name: "Hemsida",
      kind: "expected",
      cadence: "income",
      amountMinor: 8000_00,
    });
    const open = item({
      name: "El",
      kind: "mandatory",
      amountMinor: 800_00,
    });

    expect(planListStatus(loan)).toBe("open");
    expect(planListStatus(websiteIncome)).toBe("open");
    expect(isPlanSettled(loan)).toBe(false);
    expect(isPlanPartiallySettled(loan)).toBe(false);
    expect(isPlanSettled(websiteIncome)).toBe(false);

    // Order is the caller's order — a match cannot reorder anything.
    expect(sortPlanRowsForList([loan, open, websiteIncome]).map((row) => row.name)).toEqual([
      "Pappa",
      "El",
      "Hemsida",
    ]);
  });

  it("gives the row view straight from the item, with no match to pass in", () => {
    const open = item({ name: "El", kind: "mandatory", amountMinor: 800_00 });
    expect(planRowView(open)).toEqual({
      status: "open",
      settled: false,
      partial: false,
      canUndo: false,
    });
    const paid = item({
      name: "Pappa",
      kind: "mandatory",
      amountMinor: 15000_00,
      settledAt: "2026-08-27T12:00:00.000Z",
    });
    expect(planRowView(paid)).toEqual({
      status: "settled",
      settled: true,
      partial: false,
      canUndo: true,
    });
    const partly = item({
      name: "Hemsida",
      kind: "expected",
      cadence: "income",
      amountMinor: 8000_00,
      settledMinor: 3000_00,
    });
    expect(planRowView(partly)).toEqual({
      status: "partial",
      settled: false,
      partial: true,
      canUndo: true,
    });
    // planRowView takes one argument, so no caller can widen it with a match.
    expect(planRowView.length).toBe(1);
  });

  it("marks a row settled only from the explicit flags", () => {
    const tapped = item({
      name: "Pappa",
      kind: "mandatory",
      amountMinor: 15000_00,
      settledAt: "2026-08-27T12:00:00.000Z",
    });
    const tappedPartly = item({
      name: "Hemsida",
      kind: "expected",
      cadence: "income",
      amountMinor: 8000_00,
      settledMinor: 3000_00,
    });
    expect(planListStatus(tapped)).toBe("settled");
    expect(planListStatus(tappedPartly)).toBe("partial");
  });

  it("treats Delvis klar as remaining amount with a rest date", () => {
    const salary = item({
      name: "Trukks",
      kind: "expected",
      amountMinor: 51_000_00,
      cadence: "income",
      nextDueAt: "2026-08-27T12:00:00.000Z",
      settledMinor: 20_000_00,
      remainingDueAt: "2026-08-29T12:00:00.000Z",
    });
    expect(isPlanPartiallySettled(salary)).toBe(true);
    expect(isPlanSettled(salary)).toBe(false);
    expect(settledAmountMinor(salary)).toBe(20_000_00);
    expect(remainingOpenMinor(salary)).toBe(31_000_00);
    expect(remainingDueIso(salary)).toBe("2026-08-29T12:00:00.000Z");
  });

  it("shows 51 000 − 22 000 = 29 000 as the open remainder", () => {
    const trukks = item({
      name: "Trukks",
      kind: "expected",
      amountMinor: 51_000_00,
      cadence: "income",
      nextDueAt: "2026-08-27T05:00:00.000Z",
      settledMinor: 22_000_00,
      remainingDueAt: "2026-08-31T12:00:00.000Z",
    });
    expect(planPartialBreakdown(trukks)).toEqual({
      totalMinor: 51_000_00,
      settledMinor: 22_000_00,
      remainingMinor: 29_000_00,
    });
    expect(planRowHeroMinor(trukks)).toBe(29_000_00);
    expect(countsTowardCashMinor(trukks)).toBe(29_000_00);
    expect(previewPartialRemaining(51_000_00, 22_000_00)).toEqual({
      totalMinor: 51_000_00,
      settledMinor: 22_000_00,
      remainingMinor: 29_000_00,
    });
  });

  it("sums only open remainders into Kommer in / Kvar att betala", () => {
    const csn = item({
      name: "CSN",
      kind: "expected",
      amountMinor: 57_500_00,
      cadence: "income",
      nextDueAt: "2026-08-31T12:00:00.000Z",
      settledAt: "2026-08-31T12:00:00.000Z",
      settledMinor: 57_500_00,
    });
    const trukks = item({
      name: "Trukks",
      kind: "expected",
      amountMinor: 51_000_00,
      cadence: "income",
      nextDueAt: "2026-08-27T05:00:00.000Z",
      settledMinor: 22_000_00,
    });
    expect(sumCountsTowardCashMinor([csn, trukks])).toBe(29_000_00);
    expect(sumCountsTowardCashMinor([csn, trukks], new Set([trukks.id]))).toBe(0);
  });

  it("treats settledAt without settledMinor as fully Klar", () => {
    const bill = item({
      name: "El",
      kind: "mandatory",
      amountMinor: 1_400_00,
      settledAt: "2026-08-10T10:00:00.000Z",
    });
    expect(isPlanSettled(bill)).toBe(true);
    expect(isPlanPartiallySettled(bill)).toBe(false);
    expect(remainingOpenMinor(bill)).toBe(0);
  });

  it("keeps a Klar row fully Klar when the amount is edited", () => {
    const now = new Date("2026-08-27T10:00:00.000Z");
    const row = item({
      name: "Trukks",
      kind: "expected",
      amountMinor: 51_000_00,
      cadence: "income",
      nextDueAt: "2026-08-27T12:00:00.000Z",
      settledAt: "2026-08-27T08:00:00.000Z",
      settledMinor: 51_000_00,
    });
    const edited = applyPlanItemEdits(row, { amountMinor: 48_000_00 }, now);
    expect(isPlanSettled(edited)).toBe(true);
    expect(edited.settledMinor).toBe(48_000_00);
    expect(edited.remainingDueAt).toBeNull();
  });

  it("edits the rest date on Delvis klar without moving the row to another month", () => {
    const now = new Date("2026-08-27T10:00:00.000Z");
    const row = item({
      name: "Trukks",
      kind: "expected",
      amountMinor: 51_000_00,
      cadence: "income",
      nextDueAt: "2026-08-27T12:00:00.000Z",
      settledMinor: 20_000_00,
      remainingDueAt: "2026-08-29T12:00:00.000Z",
    });
    const edited = applyPlanItemEdits(
      row,
      { remainingDueAt: "2026-09-02T12:00:00.000Z" },
      now,
    );
    expect(edited.nextDueAt).toBe("2026-08-27T12:00:00.000Z");
    expect(edited.remainingDueAt).toBe("2026-09-02T12:00:00.000Z");
    expect(isPlanPartiallySettled(edited)).toBe(true);
  });

  it("lets Delvis edit the planned date independently of the rest date", () => {
    const now = new Date("2026-08-27T10:00:00.000Z");
    const row = item({
      name: "Trukks",
      kind: "expected",
      amountMinor: 51_000_00,
      cadence: "income",
      nextDueAt: "2026-08-27T12:00:00.000Z",
      settledMinor: 20_000_00,
      remainingDueAt: "2026-08-29T12:00:00.000Z",
    });
    const edited = applyPlanItemEdits(
      row,
      { nextDueAt: "2026-08-15T12:00:00.000Z" },
      now,
    );
    expect(edited.nextDueAt).toBe("2026-08-15T12:00:00.000Z");
    expect(edited.remainingDueAt).toBe("2026-08-29T12:00:00.000Z");
    expect(edited.settledMinor).toBe(20_000_00);
  });

  it("lets Mottagen edit both the planned total and the booked amount", () => {
    const now = new Date("2026-08-27T10:00:00.000Z");
    const row = item({
      name: "CSN",
      kind: "expected",
      amountMinor: 57_000_00,
      cadence: "income",
      nextDueAt: "2026-08-27T12:00:00.000Z",
      settledAt: "2026-08-27T08:00:00.000Z",
      settledMinor: 57_000_00,
    });
    const edited = applyPlanItemEdits(
      row,
      {
        amountMinor: 60_000_00,
        settledMinor: 20_000_00,
        remainingDueAt: "2026-09-10T12:00:00.000Z",
      },
      now,
    );
    expect(isPlanPartiallySettled(edited)).toBe(true);
    expect(edited.amountMinor).toBe(60_000_00);
    expect(edited.settledMinor).toBe(20_000_00);
    expect(edited.remainingDueAt).toBe("2026-09-10T12:00:00.000Z");
  });

  it("turns Delvis klar into Klar when the new amount is already covered", () => {
    const now = new Date("2026-08-27T10:00:00.000Z");
    const row = item({
      name: "Hyra",
      kind: "mandatory",
      amountMinor: 15_000_00,
      nextDueAt: "2026-08-01T12:00:00.000Z",
      settledMinor: 10_000_00,
      remainingDueAt: "2026-08-20T12:00:00.000Z",
    });
    const edited = applyPlanItemEdits(row, { amountMinor: 8_000_00 }, now);
    expect(isPlanSettled(edited)).toBe(true);
    expect(edited.settledMinor).toBe(8_000_00);
    expect(edited.remainingDueAt).toBeNull();
    expect(edited.nextDueAt).toBe("2026-08-01T12:00:00.000Z");
  });
});
