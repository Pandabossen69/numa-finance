import { UNCATEGORISED_SPEND_NAME } from "@/domain/finance";
import {
  movementsDrillForCategory,
  movementsDrillHref,
  type MovementsDrill,
} from "@/components/movements/movements-drill";

export { movementsDrillForCategory, movementsDrillHref };
export type { MovementsDrill };

/** Href for a Spenderat category row. Drill state stays in the query. */
export function categoryDrillHref(
  categoryName: string,
  opts: {
    scope: "period" | "month";
    cycleStartAt?: string | null;
    cycleEndAt?: string | null;
  },
): string {
  return movementsDrillHref(movementsDrillForCategory(categoryName, opts));
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
