import { appliesToSpending } from "./balance";
import { reservedPlanExpenseTxIds } from "./cash-coverage";
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

/**
 * Plan leftover in the viewed month: this month's plan-vs-spend result
 * plus extra carried in. **Not bank cash** — never label this "Saldo".
 *
 * Identity: `planFreeMinor − spentMinor + carriedInMinor`.
 * Savings is a separate pile. Negative only when extra could not cover the hole.
 */
export function monthLivingSaldoMinor(view: ExtraSaldoView): number {
  return view.planFreeMinor - view.spentMinor + view.carriedInMinor;
}

/** Swedish hint that ties the living pile to the calendar-month plan formula. */
export function livingVsPlanHintSv(
  view: Pick<ExtraSaldoView, "carriedInMinor">,
): string {
  if (view.carriedInMinor > 0) {
    return "Kvar i månaden (plan) minus spenderat, plus extra som följde med";
  }
  return "Kvar i månaden (plan) minus spenderat i månaden";
}

/** Planerat att leva för i månaden + extra som följde med in. */
export function monthLivingPoolMinor(view: ExtraSaldoView): number {
  return view.planFreeMinor + view.carriedInMinor;
}

/**
 * How to render the living pile without double-counting extra.
 * Hero is always `livingMinor`. When extra came in, show the two parts
 * (this month + extra in) — never a third "remaining extra" equal to the hero.
 */
export type MonthPileBreakdown = {
  livingMinor: number;
  monthSliceMinor: number;
  extraInMinor: number;
  showBreakdown: boolean;
  poolMinor: number;
  spentRatio: number;
};

export function monthPileBreakdown(view: ExtraSaldoView): MonthPileBreakdown {
  const livingMinor = monthLivingSaldoMinor(view);
  const poolMinor = monthLivingPoolMinor(view);
  const spentRatio =
    poolMinor > 0 ? Math.min(1.15, Math.max(0, view.spentMinor / poolMinor)) : 0;
  return {
    livingMinor,
    monthSliceMinor: view.monthResultMinor,
    extraInMinor: view.carriedInMinor,
    showBreakdown: view.carriedInMinor > 0,
    poolMinor,
    spentRatio,
  };
}

export function planWealthTotalMinor(livingMinor: number, savingsMinor: number): number {
  return livingMinor + savingsMinor;
}

export function projectExtraSaldoSeries(params: {
  planItems: PlanItem[];
  spendingByMonthKey: Record<string, number>;
  throughMonthKey: string;
  currentMonthKey: string;
  timeZone: string;
  startMonthKey?: string;
}): ExtraSaldoView[] {
  const start = params.startMonthKey ?? APP_PLAN_START_MONTH;
  const fromKey = start > params.throughMonthKey ? params.throughMonthKey : start;
  const keys = monthKeysInclusive(fromKey, params.throughMonthKey);
  const views: ExtraSaldoView[] = [];
  let carried = 0;

  for (const key of keys) {
    const view = closeMonthView({
      key,
      planItems: params.planItems,
      spendingByMonthKey: params.spendingByMonthKey,
      currentMonthKey: params.currentMonthKey,
      timeZone: params.timeZone,
      carried,
    });
    views.push(view);
    carried = view.nextMonthExtraMinor;
  }

  return views;
}

function closeMonthView(params: {
  key: string;
  planItems: PlanItem[];
  spendingByMonthKey: Record<string, number>;
  currentMonthKey: string;
  timeZone: string;
  carried: number;
}): ExtraSaldoView {
  const plan = projectPlanForMonth(params.planItems, params.key, params.timeZone);
  const isFuture = params.key > params.currentMonthKey;
  const spent = isFuture ? 0 : (params.spendingByMonthKey[params.key] ?? 0);
  const monthResult = isFuture ? plan.freeToSpendMinor : plan.freeToSpendMinor - spent;
  const drawn = !isFuture && monthResult < 0 ? Math.min(params.carried, -monthResult) : 0;
  const extraSaldo = isFuture
    ? Math.max(0, params.carried)
    : Math.max(0, monthResult < 0 ? params.carried + monthResult : params.carried);
  const nextMonthExtra = isFuture
    ? Math.max(0, params.carried)
    : Math.max(0, params.carried + monthResult);

  return {
    monthKey: params.key,
    planFreeMinor: plan.freeToSpendMinor,
    spentMinor: spent,
    monthResultMinor: monthResult,
    carriedInMinor: params.carried,
    drawnMinor: drawn,
    extraSaldoMinor: extraSaldo,
    nextMonthExtraMinor: nextMonthExtra,
  };
}

export function discretionarySpendingByMonthKey(params: {
  transactions: CanonicalTransaction[];
  planItems: PlanItem[];
  currency: CurrencyCode;
  timeZone: string;
}): Record<string, number> {
  const raw = spendingByMonthKey({
    transactions: params.transactions,
    currency: params.currency,
    timeZone: params.timeZone,
  });
  const out = { ...raw };
  for (const key of Object.keys(out)) {
    const reserved = reservedPlanExpenseTxIds({
      items: params.planItems,
      transactions: params.transactions,
      monthKey: key,
      timeZone: params.timeZone,
    });
    if (reserved.size === 0) continue;
    let deduct = 0;
    for (const tx of params.transactions) {
      if (!reserved.has(tx.id)) continue;
      if (monthKeyFromDate(new Date(tx.occurredAt), params.timeZone) !== key) {
        continue;
      }
      deduct += tx.amountMinor;
    }
    out[key] = Math.max(0, (out[key] ?? 0) - deduct);
  }
  return out;
}

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

export type SpendingCategoryTotal = {
  name: string;
  amountMinor: number;
  count: number;
};

/** Shown when a transaction was saved without a category. */
export const UNCATEGORISED_SPEND_NAME = "Övrigt";

/**
 * The same rows as `spendingByMonthKey`, split by category.
 *
 * Kept next to it on purpose: the categories of a month must always add up to
 * that month's spending, so both filters have to stay identical.
 */
export function spendingCategoriesByMonthKey(params: {
  transactions: CanonicalTransaction[];
  currency: CurrencyCode;
  timeZone: string;
}): Record<string, SpendingCategoryTotal[]> {
  const buckets = new Map<string, Map<string, SpendingCategoryTotal>>();
  for (const tx of params.transactions) {
    if (!appliesToSpending(tx)) continue;
    if (tx.currency !== params.currency) continue;
    const key = monthKeyFromDate(new Date(tx.occurredAt), params.timeZone);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = new Map();
      buckets.set(key, bucket);
    }
    const name = tx.category?.trim() || UNCATEGORISED_SPEND_NAME;
    const prev = bucket.get(name) ?? { name, amountMinor: 0, count: 0 };
    prev.amountMinor += tx.amountMinor;
    prev.count += 1;
    bucket.set(name, prev);
  }

  const out: Record<string, SpendingCategoryTotal[]> = {};
  for (const [key, bucket] of buckets) {
    out[key] = [...bucket.values()].sort(
      (a, b) => b.amountMinor - a.amountMinor,
    );
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
  const views = projectExtraSaldoSeries({
    planItems: params.planItems,
    spendingByMonthKey: params.spendingByMonthKey,
    throughMonthKey: params.monthKey,
    currentMonthKey: params.currentMonthKey,
    timeZone: params.timeZone,
    startMonthKey: params.startMonthKey,
  });
  const view = views.find((row) => row.monthKey === params.monthKey);
  if (view) return view;

  return closeMonthView({
    key: params.monthKey,
    planItems: params.planItems,
    spendingByMonthKey: params.spendingByMonthKey,
    currentMonthKey: params.currentMonthKey,
    timeZone: params.timeZone,
    carried: 0,
  });
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
  if (view.monthResultMinor > 0) {
    if (view.monthKey === currentMonthKey) {
      return `Följer med till ${nextName}`;
    }
    if (view.monthKey < currentMonthKey) {
      return `Följde med till ${nextName}`;
    }
  }
  if (view.monthKey === currentMonthKey && view.drawnMinor > 0) {
    return "Tas från extra saldo";
  }
  return undefined;
}
