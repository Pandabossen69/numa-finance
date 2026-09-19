import { describe, expect, it } from "vitest";
import type { PlanItem } from "./types";
import {
  livingBudgetHintSv,
  projectLivingBudget,
  remainingReservedUntilHorizon,
  remainingTodayOf,
} from "./living-budget";
import { projectPayCycle } from "./pay-cycle";
import { MONTHLY_SAVE_NAME } from "./plan-months";

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
    expect(living.usesBankBalance).toBe(true);
    expect(living.daysLeft).toBe(1);
    expect(living.livingPoolMinor).toBe(50_000_00);
    expect(living.dayBudgetMinor).toBe(50_000_00);
    expect(living.remainingTodayMinor).toBe(50_000_00);
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
    expect(living.usesBankBalance).toBe(true);
    expect(living.livingPoolMinor).toBe(50_000_00);
    expect(living.dayBudgetMinor).toBe(
      Math.floor(50_000_00 / living.daysLeft),
    );
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
      bankBalanceMinor: 50_000_00 - spentToday,
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

  it("bank-SMS tip + today's SMS spend must not show hela dagsbudgeten kvar", () => {
    // Tip already embeds today's SMS debits. If spentToday is left at 0,
    // Hem reconstructs morning from the depleted tip and shows full day left.
    const cycle = projectPayCycle(
      items,
      new Date("2026-08-14T15:00:00.000Z"),
      tz,
    );
    const tipAfterSpend = 5_274_00;
    const smsSpentToday = 1_200_00;

    const broken = projectLivingBudget({
      cycle,
      now: new Date("2026-08-14T15:00:00.000Z"),
      timeZone: tz,
      bankBalanceMinor: tipAfterSpend,
      todaySpendingMinor: 0,
    });
    expect(broken.remainingTodayMinor).toBe(broken.dayBudgetMinor);

    const fixed = projectLivingBudget({
      cycle,
      now: new Date("2026-08-14T15:00:00.000Z"),
      timeZone: tz,
      bankBalanceMinor: tipAfterSpend,
      todaySpendingMinor: smsSpentToday,
    });
    expect(fixed.dayBudgetMinor).toBe(
      Math.floor((tipAfterSpend + smsSpentToday) / fixed.daysLeft),
    );
    expect(fixed.remainingTodayMinor).toBe(
      remainingTodayOf(fixed.dayBudgetMinor, smsSpentToday),
    );
    expect(fixed.remainingTodayMinor).toBeLessThan(fixed.dayBudgetMinor);
  });

  it("keeps signed remaining when spend exceeds sticky dagsbudget", () => {
    // Live bug: 523 − 204,44 must stay 318,56 (not clamp to 0).
    expect(remainingTodayOf(204_44, 523_00)).toBe(-318_56);

    const cycle = projectPayCycle(
      items,
      new Date("2026-08-26T03:00:00.000Z"),
      tz,
    );
    const morning = projectLivingBudget({
      cycle,
      now: new Date("2026-08-26T03:00:00.000Z"),
      timeZone: tz,
      bankBalanceMinor: 50_000_00,
      cycleSpendingMinor: 0,
      todaySpendingMinor: 0,
    });
    const spentToday = morning.dayBudgetMinor + 318_56;
    const after = projectLivingBudget({
      cycle,
      now: new Date("2026-08-26T03:00:00.000Z"),
      timeZone: tz,
      bankBalanceMinor: 50_000_00 - spentToday,
      cycleSpendingMinor: spentToday,
      todaySpendingMinor: spentToday,
    });

    expect(after.dayBudgetMinor).toBe(morning.dayBudgetMinor);
    expect(after.remainingTodayMinor).toBe(-318_56);
    expect(Math.abs(after.remainingTodayMinor)).toBe(spentToday - after.dayBudgetMinor);
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

  it("counts 0 display days when next income is today, not later cycle end", () => {
    const payday = [
      item({
        name: "Trukks",
        kind: "expected",
        amountMinor: 52_000_00,
        cadence: "income",
        nextDueAt: "2026-08-27T00:00:00.000+07:00",
      }),
      item({
        name: "CSN",
        kind: "expected",
        amountMinor: 58_000_00,
        cadence: "income",
        nextDueAt: "2026-08-31T12:00:00.000Z",
      }),
    ];
    const now = new Date("2026-08-27T03:00:00.000Z");
    const cycle = projectPayCycle(payday, now, tz);
    const living = projectLivingBudget({
      cycle,
      now,
      timeZone: tz,
      bankBalanceMinor: 10_033_04,
      fundingConfirmed: false,
    });
    expect(living.mode).toBe("bridge");
    expect(living.nextIncomeAt).toBe("2026-08-27T00:00:00.000+07:00");
    expect(living.nextIncomeLabelSv?.toLowerCase()).toMatch(/27/);
    expect(living.daysUntilHorizon).toBe(0);
    expect(living.daysLeft).toBe(1);
    expect(living.daysUntilHorizon).not.toBe(4);
  });

  it("divides dagsbudget by days to the 25th paycheck, not following month end", () => {
    const now = new Date("2026-09-18T03:00:00.000Z");
    const payday = [
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
        name: "Lön okt",
        kind: "expected",
        amountMinor: 40_000_00,
        cadence: "income",
        nextDueAt: "2026-10-25T12:00:00.000Z",
      }),
    ];
    const cycle = projectPayCycle(payday, now, tz);
    const living = projectLivingBudget({
      cycle,
      now,
      timeZone: tz,
      bankBalanceMinor: 5_000_00,
      cycleSpendingMinor: 0,
      fundingConfirmed: true,
    });
    expect(living.mode).toBe("cycle");
    expect(cycle.endAt).toBe("2026-09-25T12:00:00.000Z");
    expect(living.nextIncomeAt).toBe("2026-09-25T12:00:00.000Z");
    expect(living.daysLeft).toBe(7); // 18 → 25 Sep
    expect(living.daysUntilHorizon).toBe(7);
    expect(living.daysLeft).not.toBe(12); // not Sep 30 month end
    expect(living.daysLeft).not.toBe(37); // not 25 Oct
    expect(living.dayBudgetMinor).toBe(Math.floor(5_000_00 / 7));
    expect(living.dayBudgetMinor).not.toBe(Math.floor(cycle.freeToSpendMinor / 7));
  });

  it("does not stretch the day envelope to next month's last income", () => {
    const now = new Date("2026-09-04T03:00:00.000Z");
    const items = [
      item({
        name: "Tidig aug",
        kind: "expected",
        amountMinor: 10_000_00,
        cadence: "income",
        nextDueAt: "2026-08-10T12:00:00.000Z",
      }),
      item({
        name: "Sen aug",
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
        nextDueAt: "2026-09-11T12:00:00.000Z",
      }),
      item({
        name: "Sen sep",
        kind: "expected",
        amountMinor: 30_000_00,
        cadence: "income",
        nextDueAt: "2026-09-25T12:00:00.000Z",
      }),
    ];
    const cycle = projectPayCycle(items, now, tz);
    expect(cycle.phase).toBe("full");
    expect(cycle.endAt).toBe("2026-09-25T12:00:00.000Z");
    expect(cycle.nextPaycheckAt).toBe("2026-09-11T12:00:00.000Z");

    const living = projectLivingBudget({
      cycle,
      now,
      timeZone: tz,
      bankBalanceMinor: 5_000_00,
      cycleSpendingMinor: 0,
      fundingConfirmed: true,
    });
    expect(living.mode).toBe("cycle");
    expect(living.nextIncomeAt).toBe("2026-09-11T12:00:00.000Z");
    expect(living.daysLeft).toBe(7); // 4 → 11 Sep
    expect(living.daysLeft).not.toBe(21); // not 4 → 25 Sep cycle end
    expect(living.nextIncomeLabelSv?.toLowerCase()).toMatch(/11/);
    expect(living.cycleEndLabelSv?.toLowerCase()).toMatch(/25/);
    expect(living.dayBudgetMinor).toBe(Math.floor(5_000_00 / 7));
    expect(living.dayBudgetMinor).not.toBe(Math.floor(cycle.freeToSpendMinor / 7));
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

  it("uses saldo/days to the 25th — not hidden plan freeToSpend (Spec L)", () => {
    const now = new Date("2026-09-19T03:00:00.000Z");
    const payday = [
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
    const cycle = projectPayCycle(payday, now, tz);
    const living = projectLivingBudget({
      cycle,
      now,
      timeZone: tz,
      bankBalanceMinor: 3_421_00,
      cycleSpendingMinor: 0,
      fundingConfirmed: true,
    });
    expect(living.mode).toBe("cycle");
    expect(living.daysLeft).toBe(6); // 19 → 25 Sep
    expect(living.daysLeft).not.toBe(12);
    expect(living.reservedUntilIncomeMinor).toBe(0);
    expect(living.livingPoolMinor).toBe(3_421_00);
    expect(living.dayBudgetMinor).toBe(Math.floor(3_421_00 / 6));
    expect(living.dayBudgetMinor).toBe(570_16);
    expect(living.dayBudgetMinor).not.toBe(Math.floor(cycle.freeToSpendMinor / 6));
  });

  it("reserves only open bills due before next paycheck and shows the leftover pool", () => {
    const now = new Date("2026-09-19T03:00:00.000Z");
    const payday = [
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
        name: "Hyra",
        kind: "mandatory",
        amountMinor: 1_200_00,
        nextDueAt: "2026-09-22T12:00:00.000Z",
      }),
      item({
        name: MONTHLY_SAVE_NAME,
        kind: "goal",
        amountMinor: 571_00,
        cadence: "monthly",
        nextDueAt: "2026-09-20T12:00:00.000Z",
      }),
      item({
        name: "Netflix",
        kind: "mandatory",
        amountMinor: 8_000_00,
        nextDueAt: "2026-09-28T12:00:00.000Z",
      }),
    ];
    const cycle = projectPayCycle(payday, now, tz);
    expect(remainingReservedUntilHorizon(cycle, cycle.nextPaycheckAt)).toBe(
      1_200_00 + 571_00,
    );
    const living = projectLivingBudget({
      cycle,
      now,
      timeZone: tz,
      bankBalanceMinor: 3_421_00,
      cycleSpendingMinor: 0,
      fundingConfirmed: true,
    });
    expect(living.daysLeft).toBe(6);
    expect(living.reservedUntilIncomeMinor).toBe(1_771_00);
    expect(living.livingPoolMinor).toBe(1_650_00);
    expect(living.dayBudgetMinor).toBe(275_00);
    expect(living.remainingFreeMinor).toBe(cycle.freeToSpendMinor);
  });

  it("QA test@: days to 3 okt — not cycle-end — and pool is saldo minus reserved", () => {
    const now = new Date("2026-09-19T03:00:00.000Z");
    const payday = [
      item({
        name: "Lön sep",
        kind: "expected",
        amountMinor: 33_521_00,
        cadence: "income",
        nextDueAt: "2026-09-03T12:00:00.000Z",
      }),
      item({
        name: "Lön okt",
        kind: "expected",
        amountMinor: 33_521_00,
        cadence: "income",
        nextDueAt: "2026-10-03T12:00:00.000Z",
      }),
      item({
        name: "Lön okt sen",
        kind: "expected",
        amountMinor: 10_000_00,
        cadence: "income",
        nextDueAt: "2026-10-25T12:00:00.000Z",
      }),
      item({
        name: "Hyra",
        kind: "mandatory",
        amountMinor: 12_345_00,
        nextDueAt: "2026-09-28T12:00:00.000Z",
      }),
      item({
        name: MONTHLY_SAVE_NAME,
        kind: "goal",
        amountMinor: 3_000_00,
        cadence: "monthly",
        nextDueAt: "2026-09-20T12:00:00.000Z",
      }),
    ];
    const cycle = projectPayCycle(payday, now, tz);
    expect(cycle.nextPaycheckAt).toBe("2026-10-03T12:00:00.000Z");
    expect(cycle.endAt).toBe("2026-10-25T12:00:00.000Z");
    expect(cycle.daysLeft).toBe(36); // 19 Sep → 25 Oct cycle-end
    const living = projectLivingBudget({
      cycle,
      now,
      timeZone: tz,
      bankBalanceMinor: 119_432_00,
      cycleSpendingMinor: 0,
      fundingConfirmed: true,
    });
    expect(living.mode).toBe("cycle");
    expect(living.daysLeft).toBe(14); // 19 Sep → 3 okt
    expect(living.daysUntilHorizon).toBe(14);
    expect(living.daysLeft).not.toBe(cycle.daysLeft);
    expect(living.nextIncomeLabelSv?.toLowerCase()).toMatch(/3/);
    expect(living.reservedUntilIncomeMinor).toBe(12_345_00 + 3_000_00);
    expect(living.livingPoolMinor).toBe(104_087_00);
    expect(living.dayBudgetMinor).toBe(Math.floor(104_087_00 / 14));
    expect(living.dayBudgetMinor).not.toBe(
      Math.floor(cycle.freeToSpendMinor / 14),
    );
    expect(living.dayBudgetMinor).not.toBe(Math.floor(119_432_00 / 36));
    expect(living.dayBudgetMinor).not.toBe(1_298_28);
  });
});

function hintPlain(lines: string[]): string[] {
  return lines.map((line) => line.replace(/\u00a0/g, " "));
}

describe("livingBudgetHintSv", () => {
  it("always names the daily rate and days to payday", () => {
    expect(
      hintPlain(
        livingBudgetHintSv({
          dayBudgetMinor: 570_16,
          poolMinor: 3_421_00,
          reservedMinor: 0,
          daysUntilHorizon: 6,
          nextIncomeLabelSv: "25 sep.",
        }),
      ),
    ).toEqual([
      "Du kan leva på 570,16 THB / dag",
      "3 421 THB kvar efter planerat · 6 dagar till lön 25 sep.",
    ]);
  });

  it("adds Saldo − planerat = pool when anything is reserved", () => {
    expect(
      hintPlain(
        livingBudgetHintSv({
          dayBudgetMinor: 275_00,
          poolMinor: 1_650_00,
          reservedMinor: 1_771_00,
          daysUntilHorizon: 6,
          nextIncomeLabelSv: "25 sep.",
        }),
      ),
    ).toEqual([
      "Du kan leva på 275 THB / dag",
      "1 650 THB kvar efter planerat · 6 dagar till lön 25 sep.",
      "Saldo 3 421 THB − planerat 1 771 THB = 1 650 THB",
    ]);
  });
});
