import type { MovementsFilter, MovementsPeriod } from "@/features/home/last-snapshot";

export const MOVEMENTS_EMPTY_LEDGER = "Inga rörelser än";

export const MOVEMENTS_EMPTY_FILTER =
  "Inga träffar för filtret — prova Alla, All tid eller en annan kategori.";

export type MovementsEmptyKind = "ledger" | "filter";

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
  if (input.itemCount === 0) return "ledger";
  if (input.filter !== "all") return "filter";
  if (input.category?.trim()) return "filter";
  if (input.period === "cycle") return "filter";
  return "ledger";
}

export function movementsEmptyCopy(input: {
  itemCount: number;
  filter: MovementsFilter;
  period: MovementsPeriod;
  category: string | null;
}): string {
  return movementsEmptyKind(input) === "ledger"
    ? MOVEMENTS_EMPTY_LEDGER
    : MOVEMENTS_EMPTY_FILTER;
}
