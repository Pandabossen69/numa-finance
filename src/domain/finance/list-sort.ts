/**
 * Stable list order for NUMA money surfaces.
 *
 * These comparators are display-only. They must not change totals, saldo,
 * or settle state. Same keys always produce the same order (no “random”
 * reshuffle when two rows share a date or amount).
 */

export const SV_LOCALE = "sv";

export function compareSvName(a: string, b: string): number {
  return a.localeCompare(b, SV_LOCALE);
}

export function compareId(a: string, b: string): number {
  return a.localeCompare(b);
}

function parseTime(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/** Missing / invalid dates sink to the end. */
export function compareIsoAsc(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const ta = parseTime(a);
  const tb = parseTime(b);
  if (ta == null && tb == null) return 0;
  if (ta == null) return 1;
  if (tb == null) return -1;
  return ta - tb;
}

/** Missing / invalid dates sink to the end. */
export function compareIsoDesc(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const ta = parseTime(a);
  const tb = parseTime(b);
  if (ta == null && tb == null) return 0;
  if (ta == null) return 1;
  if (tb == null) return -1;
  return tb - ta;
}

export type NewestFirstRow = {
  occurredAt: string;
  createdAt?: string | null;
  id: string;
};

/** Rörelser / Senaste / ledger timelines: newest date first, then created, then id. */
export function compareNewestFirst(a: NewestFirstRow, b: NewestFirstRow): number {
  return (
    compareIsoDesc(a.occurredAt, b.occurredAt) ||
    compareIsoDesc(a.createdAt, b.createdAt) ||
    compareId(a.id, b.id)
  );
}

export function sortNewestFirst<T extends NewestFirstRow>(
  items: readonly T[],
): T[] {
  return [...items].sort(compareNewestFirst);
}

export type SpendRollupRow = {
  amountMinor: number;
  name: string;
};

/** Per kategori / spend rollups: largest first, then Swedish name. */
export function compareSpendDesc(a: SpendRollupRow, b: SpendRollupRow): number {
  if (a.amountMinor !== b.amountMinor) return b.amountMinor - a.amountMinor;
  return compareSvName(a.name, b.name);
}

export function sortSpendDesc<T extends SpendRollupRow>(items: readonly T[]): T[] {
  return [...items].sort(compareSpendDesc);
}

export type AccountListRow = {
  isDefault: boolean;
  name: string;
  id: string;
};

/** Konton: default account first, then Swedish name, then id. */
export function compareAccountsForList(a: AccountListRow, b: AccountListRow): number {
  if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
  return compareSvName(a.name, b.name) || compareId(a.id, b.id);
}

export function sortAccountsForList<T extends AccountListRow>(
  accounts: readonly T[],
): T[] {
  return [...accounts].sort(compareAccountsForList);
}

/** Category pickers / chip strips: Swedish alphabetical. */
export function sortCategoryNamesSv(names: readonly string[]): string[] {
  return [...names].sort(compareSvName);
}
