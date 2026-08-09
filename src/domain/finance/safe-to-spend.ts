import { clampNonNegative, money, type Money } from "@/domain/money";

/**
 * Phase 0 safe-to-spend engine.
 *
 * Not monthlyBudget/30. Uses free cash after reservations and buffer,
 * spread across days until next income. Dynamic: overspending today
 * reduces future daily allowance rather than "failing" the user.
 */
export type SafeToSpendInput = {
  available: Money;
  reserved: Money;
  safetyBuffer: Money;
  daysUntilNextIncome: number;
  /** Optional remaining flexible plan for the runway window. */
  flexiblePlanRemaining?: Money;
};

export type SafeToSpendResult = {
  free: Money;
  today: Money;
  week: Money;
  daysUntilNextIncome: number;
  overTodayPlan: Money | null;
};

export function calculateFreeMoney(input: {
  available: Money;
  reserved: Money;
  safetyBuffer: Money;
}): Money {
  const freeMinor =
    input.available.amountMinor -
    input.reserved.amountMinor -
    input.safetyBuffer.amountMinor;
  return clampNonNegative(money(freeMinor, input.available.currency));
}

export function calculateSafeToSpend(
  input: SafeToSpendInput,
): SafeToSpendResult {
  const currency = input.available.currency;
  if (
    input.reserved.currency !== currency ||
    input.safetyBuffer.currency !== currency
  ) {
    throw new Error("Safe-to-spend inputs must share the same currency");
  }

  const free = calculateFreeMoney({
    available: input.available,
    reserved: input.reserved,
    safetyBuffer: input.safetyBuffer,
  });

  const days = Math.max(1, Math.floor(input.daysUntilNextIncome));

  let pool = free.amountMinor;
  if (input.flexiblePlanRemaining) {
    if (input.flexiblePlanRemaining.currency !== currency) {
      throw new Error("Flexible plan currency mismatch");
    }
    pool = Math.min(pool, Math.max(0, input.flexiblePlanRemaining.amountMinor));
  }

  const todayMinor = Math.floor(pool / days);
  const weekDays = Math.min(7, days);
  const weekMinor = Math.min(pool, todayMinor * weekDays);

  return {
    free,
    today: money(Math.max(0, todayMinor), currency),
    week: money(Math.max(0, weekMinor), currency),
    daysUntilNextIncome: days,
    overTodayPlan: null,
  };
}

/**
 * After a purchase, recompute remaining runway allowance.
 */
export function recalculateAfterSpend(
  input: SafeToSpendInput,
  spentToday: Money,
): SafeToSpendResult & { messageKey: "on_track" | "over_today" } {
  if (spentToday.currency !== input.available.currency) {
    throw new Error("Spend currency mismatch");
  }

  const remainingAvailable = money(
    input.available.amountMinor - spentToday.amountMinor,
    input.available.currency,
  );

  const base = calculateSafeToSpend({
    ...input,
    available: remainingAvailable,
  });

  const original = calculateSafeToSpend(input);
  const over =
    spentToday.amountMinor > original.today.amountMinor
      ? money(spentToday.amountMinor - original.today.amountMinor, spentToday.currency)
      : null;

  return {
    ...base,
    overTodayPlan: over,
    messageKey: over ? "over_today" : "on_track",
  };
}
