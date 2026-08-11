import { describe, expect, it } from "vitest";
import type { PlanItem } from "./types";
import {
  addMonthsPreservingDay,
  dayOfMonthFromIso,
  dueDateInMonth,
  expensesInWindow,
  labelDayOfMonthSv,
  projectPayCycle,
} from "./pay-cycle";
import { rollDueDateForward } from "./plan-months";

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

describe("pay-cycle helpers", () => {
  it("clamps day 31 into february", () => {
    expect(dueDateInMonth("2026-02", 31)).toBe("2026-02-28T12:00:00.000Z");
    expect(dayOfMonthFromIso("2026-08-25T12:00:00.000Z")).toBe(25);
    expect(addMonthsPreservingDay("2026-01-31T12:00:00.000Z", 1)).toBe(
      "2026-02-28T12:00:00.000Z",
    );
    expect(labelDayOfMonthSv(5)).toBe("den 5:e");
  });

  it("rolls due dates preserving day of month", () => {
    const rolled = rollDueDateForward(
      "2026-01-31T12:00:00.000Z",
      new Date("2026-03-05T00:00:00.000Z"),
    );
    expect(rolled).toBe("2026-03-31T12:00:00.000Z");
  });
});

describe("projectPayCycle", () => {
  const tz = "Asia/Bangkok";

  it("builds cycle from income to next income and includes mid-cycle rent", () => {
    const items = [
      item({
        name: "Lön",
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
        name: "Hyra",
        kind: "mandatory",
        amountMinor: 12_000_00,
        nextDueAt: "2026-09-01T12:00:00.000Z",
      }),
      item({
        name: "Spara denna månad",
        kind: "goal",
        amountMinor: 3_000_00,
        cadence: "savings",
        nextDueAt: "2026-08-15T12:00:00.000Z",
      }),
    ];

    const cycle = projectPayCycle(
      items,
      new Date("2026-08-26T03:00:00.000Z"),
      tz,
    );

    expect(cycle.startAt).toBe("2026-08-25T12:00:00.000Z");
    expect(cycle.endAt).toBe("2026-09-25T12:00:00.000Z");
    expect(cycle.isActive).toBe(true);
    expect(cycle.endInferred).toBe(false);
    expect(cycle.incomeMinor).toBe(40_000_00);
    expect(cycle.expenseMinor).toBe(12_000_00);
    expect(cycle.savingsMinor).toBe(3_000_00);
    expect(cycle.freeToSpendMinor).toBe(25_000_00);
    expect(cycle.expenses.map((e) => e.item.name)).toEqual(["Hyra"]);
  });

  it("infers next income as +1 month when missing", () => {
    const items = [
      item({
        name: "Lön",
        kind: "expected",
        amountMinor: 40_000_00,
        cadence: "income",
        nextDueAt: "2026-08-25T12:00:00.000Z",
      }),
      item({
        name: "El",
        kind: "mandatory",
        amountMinor: 1_000_00,
        nextDueAt: "2026-09-10T12:00:00.000Z",
      }),
    ];

    const cycle = projectPayCycle(
      items,
      new Date("2026-08-26T03:00:00.000Z"),
      tz,
    );
    expect(cycle.endAt).toBe("2026-09-25T12:00:00.000Z");
    expect(cycle.endInferred).toBe(true);
    expect(cycle.expenseMinor).toBe(1_000_00);
  });

  it("excludes expenses that fall before the paycheck", () => {
    const items = [
      item({
        name: "Lön",
        kind: "expected",
        amountMinor: 40_000_00,
        cadence: "income",
        nextDueAt: "2026-08-25T12:00:00.000Z",
      }),
      item({
        name: "Netflix",
        kind: "mandatory",
        amountMinor: 199_00,
        nextDueAt: "2026-08-20T12:00:00.000Z",
      }),
    ];
    const inWindow = expensesInWindow(
      items,
      "2026-08-25T12:00:00.000Z",
      "2026-09-25T12:00:00.000Z",
      tz,
    );
    // Aug 20 is before start; Sep 20 (rolled occurrence) is inside.
    expect(inWindow.map((e) => e.dueAt)).toEqual(["2026-09-20T12:00:00.000Z"]);
  });
});
