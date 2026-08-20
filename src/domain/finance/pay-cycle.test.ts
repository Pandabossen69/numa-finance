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

  it("pools all incomes in a month until next month's last income", () => {
    const items = [
      item({
        name: "Alltid ID",
        kind: "expected",
        amountMinor: 7_000_00,
        cadence: "income",
        nextDueAt: "2026-08-23T12:00:00.000Z",
      }),
      item({
        name: "CSN",
        kind: "expected",
        amountMinor: 58_000_00,
        cadence: "income",
        nextDueAt: "2026-08-25T12:00:00.000Z",
      }),
      item({
        name: "Trukks",
        kind: "expected",
        amountMinor: 52_000_00,
        cadence: "income",
        nextDueAt: "2026-08-25T12:00:00.000Z",
      }),
      item({
        name: "Alltid ID sep",
        kind: "expected",
        amountMinor: 7_000_00,
        cadence: "income",
        nextDueAt: "2026-09-23T12:00:00.000Z",
      }),
      item({
        name: "CSN sep",
        kind: "expected",
        amountMinor: 58_000_00,
        cadence: "income",
        nextDueAt: "2026-09-25T12:00:00.000Z",
      }),
      item({
        name: "Trukks sep",
        kind: "expected",
        amountMinor: 52_000_00,
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
        amountMinor: 5_000_00,
        cadence: "savings",
        nextDueAt: "2026-08-15T12:00:00.000Z",
      }),
    ];

    // Between early and late paychecks — landed early income counts; runway
    // ends at this month's last payment (higher kvar/dag for the short stretch).
    const on24th = projectPayCycle(
      items,
      new Date("2026-08-24T03:00:00.000Z"),
      tz,
    );
    expect(on24th.phase).toBe("partial");
    expect(on24th.isActive).toBe(true);
    expect(on24th.startAt).toBe("2026-08-23T12:00:00.000Z");
    expect(on24th.endAt).toBe("2026-08-25T12:00:00.000Z");
    expect(on24th.incomeMinor).toBe(7_000_00);
    expect(on24th.savingsMinor).toBe(0);
    expect(on24th.incomes.map((i) => i.name)).toEqual(["Alltid ID"]);

    const afterAll = projectPayCycle(
      items,
      new Date("2026-08-26T03:00:00.000Z"),
      tz,
    );
    expect(afterAll.phase).toBe("full");
    expect(afterAll.isActive).toBe(true);
    expect(afterAll.startAt).toBe("2026-08-23T12:00:00.000Z");
    expect(afterAll.endAt).toBe("2026-09-25T12:00:00.000Z");
    expect(afterAll.incomeMinor).toBe(117_000_00);
    expect(afterAll.expenseMinor).toBe(12_000_00);
    expect(afterAll.savingsMinor).toBe(5_000_00);
    expect(afterAll.freeToSpendMinor).toBe(100_000_00);
    expect(afterAll.expenses.map((e) => e.item.name)).toEqual(["Hyra"]);
  });

  it("always ends the full phase on next month's last income", () => {
    const items = [
      item({
        name: "Tidig",
        kind: "expected",
        amountMinor: 10_000_00,
        cadence: "income",
        nextDueAt: "2026-08-10T12:00:00.000Z",
      }),
      item({
        name: "Sen",
        kind: "expected",
        amountMinor: 30_000_00,
        cadence: "income",
        nextDueAt: "2026-08-25T12:00:00.000Z",
      }),
      item({
        name: "Tidig sep",
        kind: "expected",
        amountMinor: 10_000_00,
        cadence: "income",
        nextDueAt: "2026-09-10T12:00:00.000Z",
      }),
      item({
        name: "Sen sep",
        kind: "expected",
        amountMinor: 30_000_00,
        cadence: "income",
        nextDueAt: "2026-09-25T12:00:00.000Z",
      }),
    ];

    const cycle = projectPayCycle(
      items,
      new Date("2026-08-26T03:00:00.000Z"),
      tz,
    );
    expect(cycle.phase).toBe("full");
    expect(cycle.startAt).toBe("2026-08-10T12:00:00.000Z");
    expect(cycle.endAt).toBe("2026-09-25T12:00:00.000Z");
    expect(cycle.incomeMinor).toBe(40_000_00);
  });

  it("keeps August full cycle sticky when early September income lands", () => {
    const items = [
      item({
        name: "Alltid ID",
        kind: "expected",
        amountMinor: 7_000_00,
        cadence: "income",
        nextDueAt: "2026-08-23T12:00:00.000Z",
      }),
      item({
        name: "CSN",
        kind: "expected",
        amountMinor: 58_000_00,
        cadence: "income",
        nextDueAt: "2026-08-25T12:00:00.000Z",
      }),
      item({
        name: "Alltid ID sep",
        kind: "expected",
        amountMinor: 7_000_00,
        cadence: "income",
        nextDueAt: "2026-09-10T12:00:00.000Z",
      }),
      item({
        name: "CSN sep",
        kind: "expected",
        amountMinor: 58_000_00,
        cadence: "income",
        nextDueAt: "2026-09-25T12:00:00.000Z",
      }),
    ];

    const midSep = projectPayCycle(
      items,
      new Date("2026-09-12T03:00:00.000Z"),
      tz,
    );
    expect(midSep.phase).toBe("full");
    expect(midSep.fundingMonthKey).toBe("2026-08");
    expect(midSep.startAt).toBe("2026-08-23T12:00:00.000Z");
    expect(midSep.endAt).toBe("2026-09-25T12:00:00.000Z");
    expect(midSep.incomeMinor).toBe(65_000_00);
  });

  it("builds cycle from income month to next month's last income", () => {
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

  it("includes one-off extra expenses only on their due date in the cycle", () => {
    const items = [
      item({
        name: "Lön",
        kind: "expected",
        amountMinor: 40_000_00,
        cadence: "income",
        nextDueAt: "2026-08-25T12:00:00.000Z",
      }),
      item({
        name: "Lån",
        kind: "expected",
        amountMinor: 8_000_00,
        cadence: "once",
        nextDueAt: "2026-09-05T12:00:00.000Z",
      }),
      item({
        name: "Flyg okt",
        kind: "expected",
        amountMinor: 12_000_00,
        cadence: "once",
        nextDueAt: "2026-10-01T12:00:00.000Z",
      }),
    ];
    const cycle = projectPayCycle(
      items,
      new Date("2026-08-26T03:00:00.000Z"),
      tz,
    );
    expect(cycle.endAt).toBe("2026-09-25T12:00:00.000Z");
    expect(cycle.expenses.map((e) => e.item.name)).toEqual(["Lån"]);
    expect(cycle.expenseMinor).toBe(8_000_00);
    expect(cycle.freeToSpendMinor).toBe(32_000_00);
  });

  it("does not invent a next-month due from a monthly row", () => {
    const onlyAugust = expensesInWindow(
      [
        item({
          name: "Netflix",
          kind: "mandatory",
          amountMinor: 199_00,
          nextDueAt: "2026-08-20T12:00:00.000Z",
        }),
      ],
      "2026-08-25T12:00:00.000Z",
      "2026-09-25T12:00:00.000Z",
    );
    expect(onlyAugust).toEqual([]);

    const withSeptemberCopy = expensesInWindow(
      [
        item({
          name: "Netflix",
          kind: "mandatory",
          amountMinor: 199_00,
          nextDueAt: "2026-08-20T12:00:00.000Z",
        }),
        item({
          name: "Netflix",
          kind: "mandatory",
          amountMinor: 199_00,
          nextDueAt: "2026-09-20T12:00:00.000Z",
        }),
      ],
      "2026-08-25T12:00:00.000Z",
      "2026-09-25T12:00:00.000Z",
    );
    expect(withSeptemberCopy.map((e) => e.dueAt)).toEqual([
      "2026-09-20T12:00:00.000Z",
    ]);
  });

  it("counts daysLeft on Bangkok calendar days (not raw UTC hours)", () => {
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
    ];

    // 00:30 Bangkok on Aug 26 — still one calendar day after paycheck.
    const justAfterMidnight = projectPayCycle(
      items,
      new Date("2026-08-25T17:30:00.000Z"),
      tz,
    );
    expect(justAfterMidnight.isActive).toBe(true);
    // Aug 26 → Sep 25 exclusive end = 30 spend days.
    expect(justAfterMidnight.daysLeft).toBe(30);

    // Late evening Bangkok Aug 25 is still the paycheck day (0 days into cycle).
    const paycheckEvening = projectPayCycle(
      items,
      new Date("2026-08-25T15:00:00.000Z"),
      tz,
    );
    expect(paycheckEvening.daysLeft).toBe(31);
  });
});
