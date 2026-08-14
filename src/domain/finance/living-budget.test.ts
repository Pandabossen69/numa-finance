import { describe, expect, it } from "vitest";
import type { PlanItem } from "./types";
import { projectLivingBudget } from "./living-budget";
import { projectPayCycle } from "./pay-cycle";

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

describe("projectLivingBudget", () => {
  const tz = "Asia/Bangkok";

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
      name: "CSN sep",
      kind: "expected",
      amountMinor: 58_000_00,
      cadence: "income",
      nextDueAt: "2026-09-25T12:00:00.000Z",
    }),
  ];

  it("uses bank balance until first August income (bridge)", () => {
    const cycle = projectPayCycle(
      items,
      new Date("2026-08-11T03:00:00.000Z"),
      tz,
    );
    expect(cycle.isActive).toBe(false);

    const living = projectLivingBudget({
      cycle,
      now: new Date("2026-08-11T03:00:00.000Z"),
      timeZone: tz,
      bankBalanceMinor: 21_000_97,
    });

    expect(living.mode).toBe("bridge");
    expect(living.needsAvailableInput).toBe(false);
    expect(living.usesBankBalance).toBe(true);
    expect(living.remainingFreeMinor).toBe(21_000_97);
    expect(living.daysLeft).toBe(12); // 11 → 23 Aug
    expect(living.remainingTodayMinor).toBe(Math.floor(21_000_97 / 12));
    expect(living.nextIncomeAt).toBe("2026-08-23T12:00:00.000Z");
  });

  it("asks for available amount when no bank balance yet", () => {
    const cycle = projectPayCycle(
      items,
      new Date("2026-08-11T03:00:00.000Z"),
      tz,
    );
    const living = projectLivingBudget({
      cycle,
      now: new Date("2026-08-11T03:00:00.000Z"),
      timeZone: tz,
      bankBalanceMinor: null,
    });
    expect(living.mode).toBe("bridge");
    expect(living.needsAvailableInput).toBe(true);
    expect(living.remainingTodayMinor).toBe(0);
  });

  it("treats saldo 0 as a real balance (not missing truth)", () => {
    const cycle = projectPayCycle(
      items,
      new Date("2026-08-11T03:00:00.000Z"),
      tz,
    );
    const living = projectLivingBudget({
      cycle,
      now: new Date("2026-08-11T03:00:00.000Z"),
      timeZone: tz,
      bankBalanceMinor: 0,
    });
    expect(living.mode).toBe("bridge");
    expect(living.needsAvailableInput).toBe(false);
    expect(living.usesBankBalance).toBe(true);
    expect(living.remainingFreeMinor).toBe(0);
    expect(living.remainingTodayMinor).toBe(0);
  });

  it("switches to plan cycle after early income lands (partial until last)", () => {
    const cycle = projectPayCycle(
      items,
      new Date("2026-08-24T03:00:00.000Z"),
      tz,
    );
    expect(cycle.phase).toBe("partial");
    expect(cycle.incomeMinor).toBe(7_000_00);
    expect(cycle.endAt).toBe("2026-08-25T12:00:00.000Z");

    const living = projectLivingBudget({
      cycle,
      now: new Date("2026-08-24T03:00:00.000Z"),
      timeZone: tz,
      bankBalanceMinor: 50_000_00,
      cycleSpendingMinor: 0,
    });
    expect(living.mode).toBe("cycle");
    expect(living.remainingFreeMinor).toBe(7_000_00);
    expect(living.daysLeft).toBe(1);
    expect(living.remainingTodayMinor).toBe(7_000_00);
    expect(living.usesBankBalance).toBe(false);
  });

  it("recalculates full pool after last income until next last", () => {
    const cycle = projectPayCycle(
      items,
      new Date("2026-08-26T03:00:00.000Z"),
      tz,
    );
    expect(cycle.phase).toBe("full");
    expect(cycle.endAt).toBe("2026-09-25T12:00:00.000Z");

    const living = projectLivingBudget({
      cycle,
      now: new Date("2026-08-26T03:00:00.000Z"),
      timeZone: tz,
      bankBalanceMinor: 50_000_00,
      cycleSpendingMinor: 1_000_00,
    });
    expect(living.mode).toBe("cycle");
    expect(living.remainingFreeMinor).toBe(cycle.freeToSpendMinor - 1_000_00);
  });

  it("keeps sticky dagsbudget and only depletes today's remaining when you spend", () => {
    const cycle = projectPayCycle(
      items,
      new Date("2026-08-26T03:00:00.000Z"),
      tz,
    );
    expect(cycle.phase).toBe("full");

    const morning = projectLivingBudget({
      cycle,
      now: new Date("2026-08-26T03:00:00.000Z"),
      timeZone: tz,
      bankBalanceMinor: 50_000_00,
      cycleSpendingMinor: 0,
      todaySpendingMinor: 0,
    });
    expect(morning.dayBudgetMinor).toBeGreaterThan(0);
    expect(morning.remainingTodayMinor).toBe(morning.dayBudgetMinor);

    const spentToday = 300_00;
    const after = projectLivingBudget({
      cycle,
      now: new Date("2026-08-26T03:00:00.000Z"),
      timeZone: tz,
      bankBalanceMinor: 50_000_00,
      cycleSpendingMinor: spentToday,
      todaySpendingMinor: spentToday,
    });

    // Dagsbudget stays the morning rate — other days are not rewritten.
    expect(after.dayBudgetMinor).toBe(morning.dayBudgetMinor);
    // Hero remaining drops by exactly today's spend.
    expect(after.remainingTodayMinor).toBe(morning.dayBudgetMinor - spentToday);
    // Must NOT be the redistributed floor((free-spend)/days) model.
    const redistributed = Math.floor(
      (cycle.freeToSpendMinor - spentToday) / after.daysLeft,
    );
    expect(after.remainingTodayMinor).not.toBe(redistributed);
  });

  it("bridge mode also depletes sticky day budget from today's spend", () => {
    const cycle = projectPayCycle(
      items,
      new Date("2026-08-11T03:00:00.000Z"),
      tz,
    );
    const spentToday = 300_00;
    const morningSaldo = 21_000_97;
    const currentSaldo = morningSaldo - spentToday;

    const living = projectLivingBudget({
      cycle,
      now: new Date("2026-08-11T03:00:00.000Z"),
      timeZone: tz,
      bankBalanceMinor: currentSaldo,
      todaySpendingMinor: spentToday,
    });

    expect(living.mode).toBe("bridge");
    expect(living.dayBudgetMinor).toBe(Math.floor(morningSaldo / 12));
    expect(living.remainingTodayMinor).toBe(living.dayBudgetMinor - spentToday);
  });

  it("stays on bank bridge when calendar phase flipped but funding is unconfirmed", () => {
    const cycle = projectPayCycle(
      items,
      new Date("2026-08-24T03:00:00.000Z"),
      tz,
    );
    expect(cycle.phase).toBe("partial");

    const living = projectLivingBudget({
      cycle,
      now: new Date("2026-08-24T03:00:00.000Z"),
      timeZone: tz,
      bankBalanceMinor: 12_000_00,
      fundingConfirmed: false,
    });
    expect(living.mode).toBe("bridge");
    expect(living.usesBankBalance).toBe(true);
    expect(living.remainingFreeMinor).toBe(12_000_00);
  });

  it("falls back to bridge after the cycle window ends", () => {
    const cycle = projectPayCycle(
      items,
      new Date("2026-09-26T03:00:00.000Z"),
      tz,
    );
    // September wave may be active; force closed projection by using August end.
    const closed = {
      ...cycle,
      startAt: "2026-08-23T12:00:00.000Z",
      endAt: "2026-09-25T12:00:00.000Z",
      isActive: false,
      phase: "full" as const,
    };
    const living = projectLivingBudget({
      cycle: closed,
      now: new Date("2026-09-26T03:00:00.000Z"),
      timeZone: tz,
      bankBalanceMinor: 9_000_00,
      cycleSpendingMinor: 50_000_00,
      fundingConfirmed: true,
    });
    expect(living.mode).toBe("bridge");
    expect(living.remainingFreeMinor).toBe(9_000_00);
  });
});
