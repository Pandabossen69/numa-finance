import { UNCATEGORISED_SPEND_NAME } from "@/domain/finance";
import type {
  MovementsFilter,
  MovementsPeriod,
  MovementsView,
} from "@/features/home/last-snapshot";

/**
 * View Rörelser should open on when a Spenderat category is tapped.
 *
 * Keeps the current Utgifter/Alla chip and Denna månad when that still
 * shows the rows. Pay-cycle scope and any other calendar month use All tid,
 * because Rörelser' month chip is only the current month. Intäkter/Övrigt
 * type chips would hide the spend, so those fall back to Alla.
 */
export function movementsViewForCategoryDrill(
  categoryName: string,
  opts: {
    scope: "period" | "month";
    activeMonthKey: string;
    currentMonthKey: string;
    existing: MovementsView | null;
  },
): MovementsView {
  const existingFilter = opts.existing?.filter;
  const filter: MovementsFilter =
    existingFilter === "all" || existingFilter === "expense" ? existingFilter : "all";
  const sameCalendarMonth =
    opts.scope === "month" && opts.activeMonthKey === opts.currentMonthKey;
  const period: MovementsPeriod = sameCalendarMonth
    ? (opts.existing?.period ?? "month")
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
