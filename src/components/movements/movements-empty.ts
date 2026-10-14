import type { MovementsFilter, MovementsPeriod } from "@/features/home/last-snapshot";

export const MOVEMENTS_EMPTY_LEDGER = "Inga rörelser än";

export const MOVEMENTS_EMPTY_MONTH = "Inga rörelser den här månaden än";

export const MOVEMENTS_EMPTY_FILTER =
  "Inga träffar för filtret — prova Alla, All tid eller en annan kategori.";

export type MovementsEmptyKind = "ledger" | "month" | "filter";

/**
 * «Alla» plus Denna månad / All tid is the open list. An empty month must
 * not tell the user to try Alla when Alla is already selected. Utgifter,
 * Intäkter, Övrigt, a category chip, or Perioden are real filters.
 */
export function movementsEmptyKind(input: {
  itemCount: number;
  filter: MovementsFilter;
  period: MovementsPeriod;
  category: string | null;
}): MovementsEmptyKind {
  const openList = input.filter === "all" && !input.category?.trim();
  if (input.itemCount === 0) {
    return openList && input.period === "month" ? "month" : "ledger";
  }
  if (!openList) return "filter";
  if (input.period === "cycle") return "filter";
  if (input.period === "month") return "month";
  return "ledger";
}

export function movementsEmptyCopy(input: {
  itemCount: number;
  filter: MovementsFilter;
  period: MovementsPeriod;
  category: string | null;
}): string {
  const kind = movementsEmptyKind(input);
  if (kind === "filter") return MOVEMENTS_EMPTY_FILTER;
  if (kind === "month") return MOVEMENTS_EMPTY_MONTH;
  return MOVEMENTS_EMPTY_LEDGER;
}
