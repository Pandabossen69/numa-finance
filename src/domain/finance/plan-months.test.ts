import { describe, expect, it } from "vitest";
import type { PlanItem } from "./types";
import {
  isRecurringMonthly,
  perDayBudgetMinor,
  projectPlanForMonth,
  rollDueDateForward,
  spendDaysForMonth,
  withRolledMonthlyDues,
  yearMonthKeys,
  visibleMonthKeysForYear,
} from "./plan-months";

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

  it("projects fixed expenses into future months", () => {
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
    expect(sep.items.map((i) => i.name)).toEqual(["Hyra"]);
    expect(sep.extraItems).toEqual([]);
    expect(sep.incomes.map((i) => i.name)).toEqual(["Provision"]);
    expect(sep.reservedMinor).toBe(15_000_00);
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
  });

  it("keeps Hem/Plan card math identical for a live month", () => {
    const items = [
      item({
        name: "Hyra",
        kind: "mandatory",
        amountMinor: 12_000_00,
      }),
      item({
        name: "Netflix",
        kind: "mandatory",
        amountMinor: 199_00,
      }),
      item({
        name: "Buffert",
        kind: "buffer",
        amountMinor: 2_000_00,
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

  it("rolls overdue monthly dues forward", () => {
    const now = new Date("2026-08-11T03:00:00.000Z");
    const overdue = item({
      name: "Netflix",
      kind: "mandatory",
      amountMinor: 199_00,
      nextDueAt: "2026-06-01T00:00:00.000Z",
    });
    const { changed, items } = withRolledMonthlyDues([overdue], now);
    expect(changed).toHaveLength(1);
    expect(items[0]!.nextDueAt).toBe(rollDueDateForward(overdue.nextDueAt!, now));
    expect(new Date(items[0]!.nextDueAt!).getTime()).toBeGreaterThanOrEqual(
      now.getTime(),
    );
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

  it("starts 2026 at August (app founding)", () => {
    expect(visibleMonthKeysForYear(2026)[0]).toBe("2026-08");
    expect(visibleMonthKeysForYear(2026)).toEqual([
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
    ]);
    expect(visibleMonthKeysForYear(2027)[0]).toBe("2027-01");
    expect(visibleMonthKeysForYear(2027)).toHaveLength(12);
  });
});
