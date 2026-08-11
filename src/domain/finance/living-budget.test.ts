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
    expect(living.perDayMinor).toBe(Math.floor(21_000_97 / 12));
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
    expect(living.perDayMinor).toBe(0);
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
    expect(living.perDayMinor).toBe(0);
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
    expect(living.perDayMinor).toBe(7_000_00);
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
});
