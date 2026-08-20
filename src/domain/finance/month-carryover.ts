import { appliesToSpending } from "./balance";
import {
  APP_PLAN_START_MONTH,
  addMonthsKey,
  labelMonthNameSv,
  monthKeyFromDate,
  projectPlanForMonth,
} from "./plan-months";
import type { CanonicalTransaction, PlanItem } from "./types";
import type { CurrencyCode } from "@/domain/money";

/**
 * Actual leftover from one calendar month follows into the next as extra saldo.
 * A minus month draws from that extra first. Extra never goes below zero —
 * leftover of an open month stays in "kvar i månaden" until the month closes.
 */
export type ExtraSaldoView = {
  monthKey: string;
  planFreeMinor: number;
  spentMinor: number;
  /** Planerat kvar minus faktiskt spenderat (kan vara negativt). */
  monthResultMinor: number;
  /** Extra from earlier months at the start of this month. */
  carriedInMinor: number;
  /** How much of this month's deficit was covered by extra. */
  drawnMinor: number;
  /**
   * Extra saldo shown on this month. Does not include unused leftover of
   * the still-open current month (that appears on the next month).
   */
  extraSaldoMinor: number;
  /** Extra that will sit on the following month after this closeout. */
  nextMonthExtraMinor: number;
};

export function spendingByMonthKey(params: {
  transactions: CanonicalTransaction[];
  currency: CurrencyCode;
  timeZone: string;
}): Record<string, number> {
  const out: Record<string, number> = {};
  for (const tx of params.transactions) {
    if (!appliesToSpending(tx)) continue;
    if (tx.currency !== params.currency) continue;
    const key = monthKeyFromDate(new Date(tx.occurredAt), params.timeZone);
    out[key] = (out[key] ?? 0) + tx.amountMinor;
  }
  return out;
}

export function monthKeysInclusive(fromKey: string, toKey: string): string[] {
  if (fromKey > toKey) return [];
  const keys: string[] = [];
  let cursor = fromKey;
  let guard = 0;
  while (cursor <= toKey && guard < 240) {
    keys.push(cursor);
    cursor = addMonthsKey(cursor, 1);
    guard += 1;
  }
  return keys;
}

export function projectExtraSaldo(params: {
  planItems: PlanItem[];
  spendingByMonthKey: Record<string, number>;
  monthKey: string;
  currentMonthKey: string;
  timeZone: string;
  startMonthKey?: string;
}): ExtraSaldoView {
  const start = params.startMonthKey ?? APP_PLAN_START_MONTH;
  const fromKey = start > params.monthKey ? params.monthKey : start;
  const keys = monthKeysInclusive(fromKey, params.monthKey);

  let carried = 0;
  let view: ExtraSaldoView | null = null;

  for (const key of keys) {
    const plan = projectPlanForMonth(params.planItems, key, params.timeZone);
    const isFuture = key > params.currentMonthKey;
    const spent = isFuture ? 0 : (params.spendingByMonthKey[key] ?? 0);
    const monthResult = isFuture
      ? plan.freeToSpendMinor
      : plan.freeToSpendMinor - spent;
    const drawn = !isFuture && monthResult < 0 ? Math.min(carried, -monthResult) : 0;
    const extraSaldo = isFuture
      ? Math.max(0, carried)
      : Math.max(0, monthResult < 0 ? carried + monthResult : carried);
    const nextMonthExtra = isFuture
      ? Math.max(0, carried)
      : Math.max(0, carried + monthResult);

    if (key === params.monthKey) {
      view = {
        monthKey: key,
        planFreeMinor: plan.freeToSpendMinor,
        spentMinor: spent,
        monthResultMinor: monthResult,
        carriedInMinor: carried,
        drawnMinor: drawn,
        extraSaldoMinor: extraSaldo,
        nextMonthExtraMinor: nextMonthExtra,
      };
    }

    carried = nextMonthExtra;
  }

  if (view) return view;

  const plan = projectPlanForMonth(
    params.planItems,
    params.monthKey,
    params.timeZone,
  );
  return {
    monthKey: params.monthKey,
    planFreeMinor: plan.freeToSpendMinor,
    spentMinor: 0,
    monthResultMinor: plan.freeToSpendMinor,
    carriedInMinor: 0,
    drawnMinor: 0,
    extraSaldoMinor: 0,
    nextMonthExtraMinor: Math.max(0, plan.freeToSpendMinor),
  };
}

export function extraSaldoHintSv(
  view: ExtraSaldoView,
  currentMonthKey: string,
): string | undefined {
  const nextName = labelMonthNameSv(addMonthsKey(view.monthKey, 1));
  if (view.drawnMinor > 0) {
    return view.extraSaldoMinor > 0
      ? "Minus tas från extra saldo"
      : "Extra saldo är slut";
  }
  if (view.extraSaldoMinor <= 0) return undefined;
  if (view.monthKey > currentMonthKey) {
    return "Följde med från tidigare månader";
  }
  if (view.monthKey < currentMonthKey) {
    return `Följde med till ${nextName}`;
  }
  return "Pengar över från tidigare månader";
}

export function monthLeftoverHintSv(
  view: ExtraSaldoView,
  currentMonthKey: string,
): string | undefined {
  const nextName = labelMonthNameSv(addMonthsKey(view.monthKey, 1));
  if (view.monthKey !== currentMonthKey) return undefined;
  if (view.monthResultMinor > 0) {
    return `Blir extra saldo i ${nextName}`;
  }
  if (view.drawnMinor > 0) {
    return "Tas från extra saldo";
  }
  return undefined;
}
