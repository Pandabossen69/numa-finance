import { describe, expect, it } from "vitest";
import {
  availableAtStartOfDayMinor,
  calculateDayPlanMinor,
  calculateSafeToSpend,
} from "@/domain/finance";
import { money } from "@/domain/money";
import type { PlanItem } from "@/domain/finance";

function plan(
  partial: Partial<PlanItem> & Pick<PlanItem, "kind" | "amountMinor">,
): PlanItem {
  const ts = "2026-08-01T00:00:00.000Z";
  return {
    id: partial.id ?? crypto.randomUUID(),
    userId: "u1",
    name: partial.name ?? "Post",
    kind: partial.kind,
    amountMinor: partial.amountMinor,
    currency: "THB",
    cadence: partial.cadence ?? "monthly",
    nextDueAt: partial.nextDueAt ?? null,
    isActive: true,
    createdAt: ts,
    updatedAt: ts,
  };
}

describe("day plan (morning STS)", () => {
  it("restores available cash by undoing today's expenses", () => {
    const morning = availableAtStartOfDayMinor(80_000, [
      {
        amountMinor: 20_000,
        direction: "debit",
        transactionType: "expense",
        status: "confirmed",
      },
    ]);
    expect(morning).toBe(100_000);
  });

  it("undoes income as well so morning balance is recovered", () => {
    const morning = availableAtStartOfDayMinor(150_000, [
      {
        amountMinor: 20_000,
        direction: "debit",
        transactionType: "expense",
        status: "confirmed",
      },
      {
        amountMinor: 70_000,
        direction: "credit",
        transactionType: "income",
        status: "confirmed",
      },
    ]);
    expect(morning).toBe(100_000);
  });

  it("keeps day-plan stable after spend while live STS falls", () => {
    const days = 10;
    const morningAvailable = 1_700_000;
    const spentToday = 50_000;
    const availableNow = morningAvailable - spentToday;

    const live = calculateSafeToSpend({
      available: money(availableNow, "THB"),
      reserved: money(0, "THB"),
      safetyBuffer: money(0, "THB"),
      daysUntilNextIncome: days,
    });
    const morning = calculateSafeToSpend({
      available: money(morningAvailable, "THB"),
      reserved: money(0, "THB"),
      safetyBuffer: money(0, "THB"),
      daysUntilNextIncome: days,
    });

    const dayPlan = calculateDayPlanMinor({
      availableNowMinor: availableNow,
      currency: "THB",
      todayTransactions: [
        {
          amountMinor: spentToday,
          direction: "debit",
          transactionType: "expense",
          status: "confirmed",
          description: "Lunch",
          category: "mat",
          currency: "THB",
        },
      ],
      periodSpendBeforeToday: [],
      planItems: [
        plan({
          kind: "expected",
          name: "Nästa inkomst",
          amountMinor: 0,
          cadence: "income",
          nextDueAt: "2026-08-19",
        }),
      ],
      now: new Date("2026-08-09T12:00:00.000Z"),
      defaultDaysUntilIncome: days,
    });

    // Morning plan stays fixed; live STS shrinks after the spend.
    expect(dayPlan).toBe(morning.today.amountMinor);
    expect(dayPlan).toBeGreaterThan(live.today.amountMinor);
    expect(spentToday).toBeLessThan(dayPlan);
  });

  it("marks overspend correctly against morning plan, not live STS", () => {
    const days = 10;
    const morningAvailable = 1_700_000;
    const spentToday = 200_000;
    const availableNow = morningAvailable - spentToday;
    const dayPlan = calculateDayPlanMinor({
      availableNowMinor: availableNow,
      currency: "THB",
      todayTransactions: [
        {
          amountMinor: spentToday,
          direction: "debit",
          transactionType: "expense",
          status: "confirmed",
          description: "Stor shopping",
          category: "övrigt",
          currency: "THB",
        },
      ],
      periodSpendBeforeToday: [],
      planItems: [],
      now: new Date("2026-08-09T12:00:00.000Z"),
      defaultDaysUntilIncome: days,
    });
    const live = calculateSafeToSpend({
      available: money(availableNow, "THB"),
      reserved: money(0, "THB"),
      safetyBuffer: money(0, "THB"),
      daysUntilNextIncome: days,
    });

    // Against live STS this looks wildly over (double-count); morning plan is honest.
    expect(spentToday).toBeGreaterThan(dayPlan);
    expect(spentToday).toBeGreaterThan(live.today.amountMinor);
    expect(dayPlan).toBe(Math.floor(morningAvailable / days));
  });
});
