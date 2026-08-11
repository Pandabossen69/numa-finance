import type { PlanItem } from "./types";
import { NEXT_INCOME_NAME } from "./plan-totals";

export const MONTHLY_SAVE_NAME = "Spara denna månad";

/** Planned income for one month only (does not roll forward). */
export function isPlanIncome(item: PlanItem): boolean {
  if (item.name === NEXT_INCOME_NAME) return false;
  return (item.cadence ?? "").toLowerCase() === "income";
}

/** Planned savings target for one month only. */
export function isPlanSavings(item: PlanItem): boolean {
  if (item.name === NEXT_INCOME_NAME) return false;
  return (
    (item.cadence ?? "").toLowerCase() === "savings" ||
    item.name === MONTHLY_SAVE_NAME
  );
}

/** Mid-month anchor used to attach one-off income/savings to a calendar month. */
export function monthAnchorIso(monthKey: string): string {
  return `${monthKey}-15T12:00:00.000Z`;
}

/** True when the bucket repeats every month until deleted. */
export function isRecurringMonthly(item: PlanItem): boolean {
  if (item.name === NEXT_INCOME_NAME) return false;
  if (isPlanIncome(item) || isPlanSavings(item)) return false;
  const cadence = (item.cadence ?? "monthly").toLowerCase();
  if (
    cadence === "once" ||
    cadence === "one_off" ||
    cadence === "extra"
  ) {
    return false;
  }
  return cadence === "monthly" || item.kind === "mandatory";
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
export function rollDueDateForward(
  iso: string,
  now: Date = new Date(),
): string {
  const due = new Date(iso);
  if (!Number.isFinite(due.getTime())) return iso;

  const day = due.getUTCDate();
  let year = due.getUTCFullYear();
  let month = due.getUTCMonth();
  let guard = 0;

  const atMonth = (y: number, m: number) => {
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
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
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).format(date);
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
  /** Recurring fixed expenses (carry to next months). */
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
 * Project active plan buckets onto a calendar month.
 * Recurring monthly expenses always appear. One-off extras, incomes and
 * savings appear only when their nextDueAt falls in that month.
 */
export function projectPlanForMonth(
  items: PlanItem[],
  monthKey: string,
  timeZone: string,
): MonthPlanProjection {
  const active = items.filter(
    (i) => i.isActive && i.name !== NEXT_INCOME_NAME,
  );

  const fixedItems: PlanItem[] = [];
  const extraItems: PlanItem[] = [];
  const incomes: PlanItem[] = [];
  let savings: PlanItem | null = null;

  for (const item of active) {
    if (isPlanIncome(item)) {
      if (item.nextDueAt) {
        const key = monthKeyFromDate(new Date(item.nextDueAt), timeZone);
        if (key === monthKey) incomes.push(item);
      }
      continue;
    }
    if (isPlanSavings(item)) {
      if (item.nextDueAt) {
        const key = monthKeyFromDate(new Date(item.nextDueAt), timeZone);
        if (key === monthKey) {
          const prev = savings;
          if (!prev || item.updatedAt >= prev.updatedAt) {
            savings = item;
          }
        }
      }
      continue;
    }
    if (isRecurringMonthly(item)) {
      fixedItems.push(item);
      continue;
    }
    if (item.nextDueAt) {
      const key = monthKeyFromDate(new Date(item.nextDueAt), timeZone);
      if (key === monthKey) extraItems.push(item);
    }
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
export function spendDaysForMonth(
  monthKey: string,
  now: Date,
  timeZone: string,
): number {
  const total = daysInMonthKey(monthKey);
  const currentKey = monthKeyFromDate(now, timeZone);
  if (monthKey > currentKey) return total;
  if (monthKey < currentKey) return 1;

  const day = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      day: "2-digit",
    }).format(now),
  );
  return Math.max(1, total - day + 1);
}

export function perDayBudgetMinor(
  freeToSpendMinor: number,
  days: number,
): number {
  if (freeToSpendMinor <= 0) return 0;
  return Math.floor(freeToSpendMinor / Math.max(1, days));
}

export function upcomingMonthKeys(
  now: Date,
  timeZone: string,
  count = 4,
): string[] {
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
 * Returns plan items with overdue monthly nextDueAt rolled forward.
 * Does not mutate input.
 */
export function withRolledMonthlyDues(
  items: PlanItem[],
  now: Date = new Date(),
): { items: PlanItem[]; changed: PlanItem[] } {
  const changed: PlanItem[] = [];
  const next = items.map((item) => {
    if (!item.isActive || !item.nextDueAt) return item;
    if (!isRecurringMonthly(item) && item.name !== NEXT_INCOME_NAME) {
      return item;
    }
    const rolled = rollDueDateForward(item.nextDueAt, now);
    if (rolled === item.nextDueAt) return item;
    const updated = { ...item, nextDueAt: rolled, updatedAt: now.toISOString() };
    changed.push(updated);
    return updated;
  });
  return { items: next, changed };
}
