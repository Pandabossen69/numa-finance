/**
 * Split an expense edit into "counts in Kvar idag" vs "balance only".
 *
 * `applyOptimisticHomeSpend` moves both today's envelope and the balance.
 * A day that is not today must not touch Kvar idag, so the leftover balance
 * change is applied as income (balance only).
 */
export function expenseHomeDeltas(input: {
  prevMinor: number;
  nextMinor: number;
  prevToday: boolean;
  nextToday: boolean;
}): { todayDelta: number; balanceIncomeDelta: number } {
  const todayDelta =
    (input.nextToday ? input.nextMinor : 0) -
    (input.prevToday ? input.prevMinor : 0);
  const amountDelta = input.nextMinor - input.prevMinor;
  const balanceOnly = amountDelta - todayDelta;
  return { todayDelta, balanceIncomeDelta: -balanceOnly };
}
