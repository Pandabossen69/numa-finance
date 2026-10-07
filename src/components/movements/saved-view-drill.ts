import type { MovementsView } from "@/features/home/last-snapshot";
import type { MovementsDrill } from "./movements-drill";

/**
 * A drill may light Utgifter and a category on top of the saved chips.
 * If those values were written into the saved view, drop them. Period and
 * the pay-cycle bounds stay — Perioden from the user's own view is kept.
 * A filter the user already had (or changed to something else) stays.
 */
export function savedViewWithoutDrillFilters(input: {
  before: Pick<MovementsView, "filter" | "category"> | null;
  current: MovementsView;
  drill: Pick<MovementsDrill, "filter" | "category">;
}): MovementsView {
  const beforeFilter = input.before?.filter ?? "all";
  const beforeCategory = input.before?.category ?? null;
  let filter = input.current.filter;
  let category = input.current.category ?? null;
  if (filter === input.drill.filter && filter !== beforeFilter) {
    filter = beforeFilter;
  }
  if (category === input.drill.category && category !== beforeCategory) {
    category = beforeCategory;
  }
  return {
    ...input.current,
    filter,
    category,
  };
}
