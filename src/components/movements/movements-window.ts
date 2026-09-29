import {
  formatListDateSv,
  isInPayCycleWindow,
  monthKeyFromDate,
} from "@/domain/finance";
import type { MovementRow } from "@/features/finance/load-movements";
import type {
  MovementsFilter,
  MovementsPeriod,
} from "@/features/home/last-snapshot";
import { matchesCategory } from "./movements-category";

export type MovementsWindow = {
  filter: MovementsFilter;
  period: MovementsPeriod;
  category?: string | null;
  monthKey: string;
  timeZone: string;
  cycleStartAt?: string | null;
  cycleEndAt?: string | null;
};

/** Same type chips Rörelser already paints (Alla / Utgifter / Intäkter / Övrigt). */
export function movementMatchesType(
  tx: Pick<MovementRow, "transactionType">,
  filter: MovementsFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "expense") return tx.transactionType === "expense";
  if (filter === "income") return tx.transactionType === "income";
  return tx.transactionType !== "expense" && tx.transactionType !== "income";
}

/**
 * Period chip. `cycle` uses the Analys pay-cycle window
 * (`start ≤ occurred < end`). Missing start counts nothing.
 */
export function movementInPeriod(
  tx: Pick<MovementRow, "occurredAt">,
  opts: Pick<
    MovementsWindow,
    "period" | "monthKey" | "timeZone" | "cycleStartAt" | "cycleEndAt"
  >,
): boolean {
  if (opts.period === "month") {
    return monthKeyFromDate(new Date(tx.occurredAt), opts.timeZone) === opts.monthKey;
  }
  if (opts.period === "cycle") {
    return isInPayCycleWindow(tx.occurredAt, opts.cycleStartAt, opts.cycleEndAt);
  }
  return true;
}

/** List row: type chip, category chip, and the active period window. */
export function movementVisibleInRorelser(
  tx: Pick<MovementRow, "transactionType" | "category" | "occurredAt">,
  opts: MovementsWindow,
): boolean {
  if (!movementMatchesType(tx, opts.filter)) return false;
  if (!matchesCategory(tx.category, opts.category ?? null)) return false;
  return movementInPeriod(tx, opts);
}

/**
 * Intäkter / Utgifter / Netto for the pay-cycle window.
 * Same split as the month and all-time cards: confirmed expense debits and
 * income, not the category chip. Callers pass already-confirmed rows.
 */
export function cycleWindowTotals(
  items: readonly Pick<
    MovementRow,
    "occurredAt" | "transactionType" | "direction" | "amountMinor"
  >[],
  cycleStartAt?: string | null,
  cycleEndAt?: string | null,
): { incomeMinor: number; expenseMinor: number; netMinor: number } {
  let incomeMinor = 0;
  let expenseMinor = 0;
  for (const tx of items) {
    if (!isInPayCycleWindow(tx.occurredAt, cycleStartAt, cycleEndAt)) continue;
    if (tx.transactionType === "expense" && tx.direction === "debit") {
      expenseMinor += tx.amountMinor;
    } else if (tx.transactionType === "income") {
      incomeMinor += tx.amountMinor;
    }
  }
  return { incomeMinor, expenseMinor, netMinor: incomeMinor - expenseMinor };
}

/** Swedish range under the Perioden chip, e.g. «3 sep. – 25 okt.». */
export function payCycleRangeLabelSv(
  startAt: string | null | undefined,
  endAt: string | null | undefined,
  timeZone: string,
): string | null {
  if (!startAt || !Number.isFinite(Date.parse(startAt))) return null;
  const start = formatListDateSv(startAt, timeZone);
  if (!endAt || !Number.isFinite(Date.parse(endAt))) return start;
  return `${start} – ${formatListDateSv(endAt, timeZone)}`;
}
