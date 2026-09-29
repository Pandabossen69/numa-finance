import { UNCATEGORISED_SPEND_NAME } from "@/domain/finance";
import type {
  MovementsFilter,
  MovementsPeriod,
  MovementsView,
} from "@/features/home/last-snapshot";

/**
 * View Rörelser should open on when a Spenderat category is tapped.
 *
 * Perioden uses the same pay-cycle window as Analys Spenderat (`cycle`)
 * and Utgifter, so income cannot inflate the category count. Månad on the
 * current calendar month keeps Denna månad / All tid (Spec U). Any other
 * calendar month still uses All tid — Rörelser has no chip for a past month.
 * Intäkter/Övrigt type chips would hide the spend, so those fall back to Alla
 * on the month path.
 */
export function movementsViewForCategoryDrill(
  categoryName: string,
  opts: {
    scope: "period" | "month";
    activeMonthKey: string;
    currentMonthKey: string;
    existing: MovementsView | null;
    cycleStartAt?: string | null;
    cycleEndAt?: string | null;
  },
): MovementsView {
  if (opts.scope === "period") {
    return {
      filter: "expense",
      period: "cycle",
      category: categoryName,
      cycleStartAt: opts.cycleStartAt ?? null,
      cycleEndAt: opts.cycleEndAt ?? null,
    };
  }

  const existingFilter = opts.existing?.filter;
  const filter: MovementsFilter =
    existingFilter === "all" || existingFilter === "expense" ? existingFilter : "all";
  const sameCalendarMonth =
    opts.activeMonthKey === opts.currentMonthKey;
  const existingPeriod = opts.existing?.period;
  const period: MovementsPeriod = sameCalendarMonth
    ? existingPeriod === "month" || existingPeriod === "all"
      ? existingPeriod
      : "month"
    : "all";
  return { filter, period, category: categoryName };
}

/**
 * True when the biggest listed category is Övrigt and it is at least half
 * of the listed Spenderat (the same sum as the hero — not a second total).
 */
export function ovrigtDominatesSpend(
  categories: ReadonlyArray<{ name: string; amountMinor: number }>,
): boolean {
  const top = categories[0];
  if (!top || top.name !== UNCATEGORISED_SPEND_NAME) return false;
  let listed = 0;
  for (const category of categories) listed += category.amountMinor;
  if (listed <= 0) return false;
  return top.amountMinor * 2 >= listed;
}
