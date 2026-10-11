import { projectPayCycle, type PlanItem } from "@/domain/finance";
import type { PlanMonthView } from "@/features/home/last-snapshot";

/**
 * Analys → Månad opens on the live salary month when a pay cycle exists.
 * No paycheck → the calendar month, same as before.
 * A month the user already chose (including via Plan) still wins.
 */
export function defaultAnalysMonthKey(input: {
  planItems: readonly PlanItem[];
  currentMonthKey: string;
  timeZone: string;
  now?: Date;
}): string {
  if (!input.currentMonthKey || input.planItems.length === 0) {
    return input.currentMonthKey;
  }
  const live = projectPayCycle(
    [...input.planItems],
    input.now ?? new Date(),
    input.timeZone,
  );
  if (!live.startAt || !live.fundingMonthKey) return input.currentMonthKey;
  return live.fundingMonthKey;
}

/**
 * Older saves stored the civil month when Plan mounted, without a choice.
 * A different key was an actual browse and should stick.
 */
export function sharedMonthIsPicked(
  shared: PlanMonthView | null | undefined,
  calendarMonthKey: string,
): boolean {
  if (!shared?.monthKey) return false;
  if (shared.picked === true) return true;
  if (shared.picked === false) return false;
  return shared.monthKey !== calendarMonthKey;
}

export function analysActiveMonthKey(input: {
  shared: PlanMonthView | null | undefined;
  planItems: readonly PlanItem[];
  currentMonthKey: string;
  timeZone: string;
  now?: Date;
}): string {
  if (sharedMonthIsPicked(input.shared, input.currentMonthKey) && input.shared) {
    return input.shared.monthKey;
  }
  return defaultAnalysMonthKey(input);
}
