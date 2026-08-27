import { zonedDayKey } from "./datetime";
import type { PlanItem } from "./types";
import { NEXT_INCOME_NAME } from "./plan-totals";

export const MONTHLY_SAVE_NAME = "Spara denna månad";

/** Planned income for one month only (does not roll forward). */
export function isPlanIncome(item: PlanItem): boolean {
  if (item.name === NEXT_INCOME_NAME) return false;
  return (item.cadence ?? "").toLowerCase() === "income";
}

/** Amount already marked received/paid. Legacy `settledAt` counts as the full amount. */
export function settledAmountMinor(item: PlanItem): number {
  const amount = Math.max(0, item.amountMinor);
  if (typeof item.settledMinor === "number" && Number.isFinite(item.settledMinor)) {
    return Math.min(amount, Math.max(0, Math.round(item.settledMinor)));
  }
  if (typeof item.settledAt === "string" && item.settledAt.length > 0) {
    return amount;
  }
  return 0;
}

/** Still open after Klar / Delvis klar. */
export function remainingOpenMinor(item: PlanItem): number {
  return Math.max(0, item.amountMinor - settledAmountMinor(item));
}

/**
 * Amount that still counts in Kommer in / Kvar att betala.
 * Ledger-matched rows are already in saldo and must not be counted again.
 */
export function countsTowardCashMinor(
  item: PlanItem,
  ledgerMatched = false,
): number {
  if (ledgerMatched) return 0;
  return remainingOpenMinor(item);
}

export function sumCountsTowardCashMinor(
  items: readonly PlanItem[],
  matchedIds: ReadonlySet<string> = new Set(),
): number {
  let sum = 0;
  for (const item of items) {
    sum += countsTowardCashMinor(item, matchedIds.has(item.id));
  }
  return sum;
}

/** Hero number on a Plan row: remaining after Delvis klar, otherwise the planned amount. */
export function planRowHeroMinor(item: PlanItem): number {
  if (isPlanPartiallySettled(item)) return remainingOpenMinor(item);
  return item.amountMinor;
}

export type PlanPartialBreakdown = {
  totalMinor: number;
  settledMinor: number;
  remainingMinor: number;
};

/** 51 000 − 22 000 = 29 000 while a row is Delvis klar. */
export function planPartialBreakdown(item: PlanItem): PlanPartialBreakdown | null {
  if (!isPlanPartiallySettled(item)) return null;
  const settledMinor = settledAmountMinor(item);
  return {
    totalMinor: item.amountMinor,
    settledMinor,
    remainingMinor: item.amountMinor - settledMinor,
  };
}

/** Live remainder while typing Delvis klar. */
export function previewPartialRemaining(
  amountMinor: number,
  typedSettledMinor: number | null,
): PlanPartialBreakdown | null {
  if (typedSettledMinor == null || !Number.isFinite(typedSettledMinor)) return null;
  const totalMinor = Math.max(0, Math.round(amountMinor));
  const settledMinor = Math.min(totalMinor, Math.max(0, Math.round(typedSettledMinor)));
  return {
    totalMinor,
    settledMinor,
    remainingMinor: totalMinor - settledMinor,
  };
}

/** True when this occurrence was marked fully Klar (paid/received). */
export function isPlanSettled(item: PlanItem): boolean {
  if (item.amountMinor > 0) {
    return settledAmountMinor(item) >= item.amountMinor;
  }
  return typeof item.settledAt === "string" && item.settledAt.length > 0;
}

/** True when some but not all of the amount is marked received/paid. */
export function isPlanPartiallySettled(item: PlanItem): boolean {
  const settled = settledAmountMinor(item);
  return settled > 0 && settled < item.amountMinor;
}

export type PlanListStatus = "open" | "partial" | "settled";

/** Visual / sort status: Delvis, then clicked or ledger-matched Betald/Mottagen. */
export function planListStatus(
  item: PlanItem,
  ledgerMatched = false,
): PlanListStatus {
  if (isPlanPartiallySettled(item)) return "partial";
  if (isPlanSettled(item) || ledgerMatched) return "settled";
  return "open";
}

const PLAN_LIST_RANK: Record<PlanListStatus, number> = {
  open: 0,
  partial: 1,
  settled: 2,
};

/** Open rows first, Delvis just above Betald/Mottagen, paid last. Stable otherwise. */
export function sortPlanRowsForList(
  items: readonly PlanItem[],
  matchedIds: ReadonlySet<string> = new Set(),
): PlanItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const rankA =
        PLAN_LIST_RANK[planListStatus(a.item, matchedIds.has(a.item.id))];
      const rankB =
        PLAN_LIST_RANK[planListStatus(b.item, matchedIds.has(b.item.id))];
      if (rankA !== rankB) return rankA - rankB;
      return a.index - b.index;
    })
    .map((row) => row.item);
}

/** Date used for the open remainder (Delvis klar) or the original due date. */
export function remainingDueIso(item: PlanItem): string | null {
  if (isPlanPartiallySettled(item) && item.remainingDueAt) {
    return item.remainingDueAt;
  }
  return item.nextDueAt;
}

/**
 * Apply name/amount/date from Plan edit without breaking Klar / Delvis klar.
 * - Fully Klar stays Klar at the new amount (row can still move date).
 * - Delvis klar keeps the original month (`nextDueAt`); the date field is the rest.
 * - If the new amount is covered by what is already marked, it becomes fully Klar.
 */
export function applyPlanItemEdits(
  item: PlanItem,
  patch: {
    name?: string;
    amountMinor?: number;
    nextDueAt?: string | null;
  },
  now: Date = new Date(),
): PlanItem {
  const name = patch.name ?? item.name;
  const amountMinor = patch.amountMinor ?? item.amountMinor;
  const dateTouched = patch.nextDueAt !== undefined;
  const pickedDue = dateTouched ? patch.nextDueAt : item.nextDueAt;
  const ts = now.toISOString();

  if (isPlanSettled(item)) {
    return {
      ...item,
      name,
      amountMinor,
      nextDueAt: pickedDue ?? item.nextDueAt,
      settledAt: item.settledAt ?? ts,
      settledMinor: amountMinor,
      remainingDueAt: null,
      updatedAt: ts,
    };
  }

  if (isPlanPartiallySettled(item)) {
    const settled = settledAmountMinor(item);
    if (settled >= amountMinor) {
      return {
        ...item,
        name,
        amountMinor,
        nextDueAt: item.nextDueAt,
        settledAt: item.settledAt ?? ts,
        settledMinor: amountMinor,
        remainingDueAt: null,
        updatedAt: ts,
      };
    }
    return {
      ...item,
      name,
      amountMinor,
      nextDueAt: item.nextDueAt,
      settledAt: null,
      settledMinor: settled,
      remainingDueAt: dateTouched
        ? (pickedDue ?? item.remainingDueAt ?? item.nextDueAt)
        : (item.remainingDueAt ?? item.nextDueAt),
      updatedAt: ts,
    };
  }

  return {
    ...item,
    name,
    amountMinor,
    nextDueAt: pickedDue ?? item.nextDueAt,
    updatedAt: ts,
  };
}

/** Planned savings target for one month only. */
export function isPlanSavings(item: PlanItem): boolean {
  if (item.name === NEXT_INCOME_NAME) return false;
  return (
    (item.cadence ?? "").toLowerCase() === "savings" || item.name === MONTHLY_SAVE_NAME
  );
}

/** Mid-month anchor used to attach one-off income/savings to a calendar month. */
export function monthAnchorIso(monthKey: string): string {
  return `${monthKey}-15T12:00:00.000Z`;
}

/**
 * True when the bucket is a *fixed* monthly expense (hyra, el, Netflix).
 * Recurrence is copy-forward in the UI — one row is never cloned across months.
 */
export function isRecurringMonthly(item: PlanItem): boolean {
  if (item.name === NEXT_INCOME_NAME) return false;
  if (isPlanIncome(item) || isPlanSavings(item)) return false;
  const cadence = (item.cadence ?? "monthly").toLowerCase();
  if (cadence === "once" || cadence === "one_off" || cadence === "extra") {
    return false;
  }
  return cadence === "monthly" || item.kind === "mandatory";
}

/** Calendar month a plan row belongs to, from `nextDueAt`. */
export function planItemMonthKey(item: PlanItem, timeZone: string): string | null {
  if (!item.nextDueAt) return null;
  const t = Date.parse(item.nextDueAt);
  if (!Number.isFinite(t)) return null;
  return monthKeyFromDate(new Date(item.nextDueAt), timeZone);
}

export function normalizeFixedExpenseName(name: string): string {
  return name.trim().toLocaleLowerCase("sv-SE");
}

/**
 * Previous month's fixed expenses that the target month does not already have
 * (matched on normalized name). Used by "Läs in från …".
 */
export function importableFixedExpenses(params: {
  items: PlanItem[];
  fromMonthKey: string;
  toMonthKey: string;
  timeZone: string;
}): PlanItem[] {
  const from = projectPlanForMonth(params.items, params.fromMonthKey, params.timeZone);
  const to = projectPlanForMonth(params.items, params.toMonthKey, params.timeZone);
  const taken = new Set(
    to.fixedItems.map((item) => normalizeFixedExpenseName(item.name)),
  );
  return from.fixedItems.filter(
    (item) => !taken.has(normalizeFixedExpenseName(item.name)),
  );
}

/** One-off planned expense (loan payment, trip, etc.) — date-scoped only. */
export function isPlanExtraExpense(item: PlanItem): boolean {
  if (!item.isActive || item.name === NEXT_INCOME_NAME) return false;
  if (isPlanIncome(item) || isPlanSavings(item)) return false;
  return !isRecurringMonthly(item);
}

/**
 * Advance a due date forward one calendar month at a time until it is
 * on/after `now`, preserving day-of-month (clamped for short months).
 */
export function rollDueDateForward(iso: string, now: Date = new Date()): string {
  const due = new Date(iso);
  if (!Number.isFinite(due.getTime())) return iso;

  const day = due.getUTCDate();
  let year = due.getUTCFullYear();
  let month = due.getUTCMonth();
  let guard = 0;

  const atMonth = (y: number, m: number) => {
    const max = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const clamped = Math.min(day, max);
    return new Date(Date.UTC(y, m, clamped, 12, 0, 0));
  };

  let cursor = atMonth(year, month);
  while (cursor.getTime() < now.getTime() && guard < 120) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    cursor = atMonth(year, month);
    guard += 1;
  }
  return cursor.toISOString();
}

export function monthKeyFromDate(date: Date, timeZone: string): string {
  // YYYY-MM from zoned calendar day (never UTC slice of toISOString).
  return zonedDayKey(date, timeZone).slice(0, 7);
}

export function addMonthsKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y!, (m ?? 1) - 1 + delta, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

export function labelMonthSv(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
  return d.toLocaleDateString("sv-SE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type MonthPlanProjection = {
  monthKey: string;
  labelSv: string;
  /** All expenses for the month (fixed + extras). */
  items: PlanItem[];
  /** Fixed expenses whose nextDueAt falls in this month. */
  fixedItems: PlanItem[];
  /** One-off extras due only in this month. */
  extraItems: PlanItem[];
  /** Income rows that belong only to this month. */
  incomes: PlanItem[];
  /** Optional savings target for this month only. */
  savings: PlanItem | null;
  reservedMinor: number;
  bufferMinor: number;
  flexibleMinor: number;
  incomeMinor: number;
  savingsMinor: number;
  fixedMinor: number;
  extraMinor: number;
  /** Income − expenses − savings (can be negative). */
  freeToSpendMinor: number;
  totalPlannedMinor: number;
};

/**
 * Planned savings from the app start month through `throughMonthKey`.
 * Each month's savings stays in that month in the plan — this sum is what
 * you have set aside so far when looking at a later month.
 */
export function cumulativePlanSavingsMinor(
  items: PlanItem[],
  throughMonthKey: string,
  timeZone: string,
  startMonthKey: string = APP_PLAN_START_MONTH,
): number {
  const fromKey = startMonthKey > throughMonthKey ? throughMonthKey : startMonthKey;
  let sum = 0;
  let cursor = fromKey;
  let guard = 0;
  while (cursor <= throughMonthKey && guard < 240) {
    sum += projectPlanForMonth(items, cursor, timeZone).savingsMinor;
    cursor = addMonthsKey(cursor, 1);
    guard += 1;
  }
  return sum;
}

/**
 * Project active plan buckets onto a calendar month.
 * Fixed expenses, extras, incomes and savings all appear only when their
 * nextDueAt falls in that month. Fixed rows are never cloned into other months.
 */
export function projectPlanForMonth(
  items: PlanItem[],
  monthKey: string,
  timeZone: string,
): MonthPlanProjection {
  const active = items.filter((i) => i.isActive && i.name !== NEXT_INCOME_NAME);

  const fixedItems: PlanItem[] = [];
  const extraItems: PlanItem[] = [];
  const incomes: PlanItem[] = [];
  let savings: PlanItem | null = null;

  for (const item of active) {
    const dueMonth = planItemMonthKey(item, timeZone);
    if (isPlanIncome(item)) {
      if (dueMonth === monthKey) incomes.push(item);
      continue;
    }
    if (isPlanSavings(item)) {
      if (dueMonth === monthKey) {
        const prev = savings;
        if (!prev || item.updatedAt >= prev.updatedAt) {
          savings = item;
        }
      }
      continue;
    }
    if (isRecurringMonthly(item)) {
      if (dueMonth === monthKey) fixedItems.push(item);
      continue;
    }
    if (dueMonth === monthKey) extraItems.push(item);
  }

  const projected = [...fixedItems, ...extraItems];

  let reservedMinor = 0;
  let bufferMinor = 0;
  let flexibleMinor = 0;
  for (const item of projected) {
    if (item.kind === "buffer") bufferMinor += item.amountMinor;
    else if (item.kind === "flexible") flexibleMinor += item.amountMinor;
    else if (
      item.kind === "mandatory" ||
      item.kind === "expected" ||
      item.kind === "goal"
    ) {
      reservedMinor += item.amountMinor;
    }
  }

  const incomeMinor = incomes.reduce((sum, i) => sum + i.amountMinor, 0);
  const savingsMinor = savings?.amountMinor ?? 0;
  const fixedMinor = fixedItems.reduce((sum, i) => sum + i.amountMinor, 0);
  const extraMinor = extraItems.reduce((sum, i) => sum + i.amountMinor, 0);
  const totalPlannedMinor = reservedMinor + bufferMinor + flexibleMinor;
  const freeToSpendMinor = incomeMinor - totalPlannedMinor - savingsMinor;

  return {
    monthKey,
    labelSv: labelMonthSv(monthKey),
    items: projected,
    fixedItems,
    extraItems,
    incomes,
    savings,
    reservedMinor,
    bufferMinor,
    flexibleMinor,
    incomeMinor,
    savingsMinor,
    fixedMinor,
    extraMinor,
    freeToSpendMinor,
    totalPlannedMinor,
  };
}

/** Calendar days in a month key (`2026-08` → 31). */
export function daysInMonthKey(monthKey: string): number {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
}

/**
 * Days left to spend in a month (inclusive of today when current month).
 * Future months: full month length. Past months: 1 (avoid div/0).
 */
export function spendDaysForMonth(monthKey: string, now: Date, timeZone: string): number {
  const total = daysInMonthKey(monthKey);
  const currentKey = monthKeyFromDate(now, timeZone);
  if (monthKey > currentKey) return total;
  if (monthKey < currentKey) return 1;

  const day = Number(zonedDayKey(now, timeZone).slice(8, 10));
  return Math.max(1, total - day + 1);
}

export function perDayBudgetMinor(freeToSpendMinor: number, days: number): number {
  if (freeToSpendMinor <= 0) return 0;
  return Math.floor(freeToSpendMinor / Math.max(1, days));
}

export function upcomingMonthKeys(now: Date, timeZone: string, count = 4): string[] {
  const base = monthKeyFromDate(now, timeZone);
  return Array.from({ length: count }, (_, i) => addMonthsKey(base, i));
}

/** App launch month — 2026 planning starts here (no Jan–Jul). */
export const APP_PLAN_START_MONTH = "2026-08";

/** All 12 month keys for a calendar year (`2026-01` … `2026-12`). */
export function yearMonthKeys(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, "0");
    return `${year}-${mm}`;
  });
}

/**
 * Months shown in the Plan year strip.
 * 2026 starts at August (app founding); other years are Jan–Dec.
 */
export function visibleMonthKeysForYear(year: number): string[] {
  const all = yearMonthKeys(year);
  const [startY, startM] = APP_PLAN_START_MONTH.split("-").map(Number);
  if (year < startY!) return all;
  if (year > startY!) return all;
  return all.filter((key) => {
    const m = Number(key.slice(5));
    return m >= startM!;
  });
}

/** Short Swedish month name without year, e.g. `augusti`. */
export function labelMonthNameSv(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
  return d.toLocaleDateString("sv-SE", {
    month: "long",
    timeZone: "UTC",
  });
}

export function yearFromMonthKey(monthKey: string): number {
  return Number(monthKey.slice(0, 4));
}

/**
 * Rolls only the "Nästa inkomst" pointer forward.
 * Fixed expenses stay pinned to the month they were saved in so past months
 * never change when a new month starts.
 */
export function withRolledMonthlyDues(
  items: PlanItem[],
  now: Date = new Date(),
): { items: PlanItem[]; changed: PlanItem[] } {
  const changed: PlanItem[] = [];
  const next = items.map((item) => {
    if (!item.isActive || !item.nextDueAt) return item;
    if (item.name !== NEXT_INCOME_NAME) return item;
    const rolled = rollDueDateForward(item.nextDueAt, now);
    if (rolled === item.nextDueAt) return item;
    const updated = { ...item, nextDueAt: rolled, updatedAt: now.toISOString() };
    changed.push(updated);
    return updated;
  });
  return { items: next, changed };
}
