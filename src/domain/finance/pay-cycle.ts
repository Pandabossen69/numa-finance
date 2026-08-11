import type { PlanItem } from "./types";
import { NEXT_INCOME_NAME } from "./plan-totals";
import {
  addMonthsKey,
  daysInMonthKey,
  isPlanIncome,
  isPlanSavings,
  isRecurringMonthly,
  monthKeyFromDate,
  perDayBudgetMinor,
  projectPlanForMonth,
} from "./plan-months";

/** Day of month (1–31) from an ISO timestamp, using UTC calendar date. */
export function dayOfMonthFromIso(iso: string): number {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return 1;
  return d.getUTCDate();
}

/** Clamp day into a month and return noon-UTC ISO for that calendar day. */
export function dueDateInMonth(monthKey: string, day: number): string {
  const max = daysInMonthKey(monthKey);
  const clamped = Math.min(Math.max(1, Math.floor(day)), max);
  const dd = String(clamped).padStart(2, "0");
  return `${monthKey}-${dd}T12:00:00.000Z`;
}

/** Add calendar months while preserving day-of-month (clamped). */
export function addMonthsPreservingDay(iso: string, months: number): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const day = d.getUTCDate();
  const base = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1, 12, 0, 0),
  );
  const monthKey = `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}`;
  return dueDateInMonth(monthKey, day);
}

export type CycleExpense = {
  item: PlanItem;
  dueAt: string;
};

export type PayCycleProjection = {
  /** Inclusive cycle start (income arrival). */
  startAt: string | null;
  /** Exclusive cycle end (next income). */
  endAt: string | null;
  startLabelSv: string | null;
  endLabelSv: string | null;
  /** True when start ≤ now < end. */
  isActive: boolean;
  /** True when cycle is inferred (no next income row — assumed +1 month). */
  endInferred: boolean;
  incomes: PlanItem[];
  expenses: CycleExpense[];
  incomeMinor: number;
  expenseMinor: number;
  reservedMinor: number;
  bufferMinor: number;
  flexibleMinor: number;
  savingsMinor: number;
  freeToSpendMinor: number;
  /** Days from now (or start if future) until end, min 1 when cycle exists. */
  daysLeft: number;
  perDayMinor: number;
};

function labelDateSv(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", {
    timeZone,
    day: "numeric",
    month: "short",
  });
}

function startOfZonedDayMs(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) return now.getTime();
  // Compare using UTC noon anchors for date-only plan items.
  return Date.parse(`${y}-${m}-${d}T12:00:00.000Z`);
}

function incomeDates(items: PlanItem[]): Array<{ item: PlanItem; at: number; iso: string }> {
  const out: Array<{ item: PlanItem; at: number; iso: string }> = [];
  for (const item of items) {
    if (!item.isActive || !item.nextDueAt) continue;
    const isIncome =
      isPlanIncome(item) ||
      item.name === NEXT_INCOME_NAME ||
      (item.cadence ?? "").toLowerCase() === "income";
    if (!isIncome) continue;
    // Zero-amount NEXT_INCOME marker only counts as a boundary, not pool income —
    // still include in date list.
    const at = Date.parse(item.nextDueAt);
    if (!Number.isFinite(at)) continue;
    out.push({ item, at, iso: item.nextDueAt });
  }
  out.sort((a, b) => a.at - b.at);
  return out;
}

function expenseAmountParts(item: PlanItem): {
  reserved: number;
  buffer: number;
  flexible: number;
} {
  if (item.kind === "buffer") {
    return { reserved: 0, buffer: item.amountMinor, flexible: 0 };
  }
  if (item.kind === "flexible") {
    return { reserved: 0, buffer: 0, flexible: item.amountMinor };
  }
  if (
    item.kind === "mandatory" ||
    item.kind === "expected" ||
    item.kind === "goal"
  ) {
    return { reserved: item.amountMinor, buffer: 0, flexible: 0 };
  }
  return { reserved: 0, buffer: 0, flexible: 0 };
}

/**
 * Recurring / one-off expense occurrences that fall in [start, end).
 */
export function expensesInWindow(
  items: PlanItem[],
  startIso: string,
  endIso: string,
  timeZone: string,
): CycleExpense[] {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return [];
  }

  const startKey = monthKeyFromDate(new Date(startIso), timeZone);
  const endKey = monthKeyFromDate(new Date(endIso), timeZone);
  const monthKeys: string[] = [];
  let cursor = startKey;
  let guard = 0;
  while (cursor <= endKey && guard < 36) {
    monthKeys.push(cursor);
    cursor = addMonthsKey(cursor, 1);
    guard += 1;
  }
  // Also one month before start (expense on day 1 when cycle starts mid-month previous).
  monthKeys.unshift(addMonthsKey(startKey, -1));

  const result: CycleExpense[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (!item.isActive || item.name === NEXT_INCOME_NAME) continue;
    if (isPlanIncome(item) || isPlanSavings(item)) continue;

    if (isRecurringMonthly(item)) {
      const day = item.nextDueAt ? dayOfMonthFromIso(item.nextDueAt) : 1;
      for (const monthKey of monthKeys) {
        const dueAt = dueDateInMonth(monthKey, day);
        const t = Date.parse(dueAt);
        if (t >= start && t < end) {
          const key = `${item.id}:${dueAt}`;
          if (!seen.has(key)) {
            seen.add(key);
            result.push({ item, dueAt });
          }
        }
      }
      continue;
    }

    if (item.nextDueAt) {
      const t = Date.parse(item.nextDueAt);
      if (t >= start && t < end) {
        const key = `${item.id}:${item.nextDueAt}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({ item, dueAt: item.nextDueAt });
        }
      }
    }
  }

  result.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  return result;
}

function emptyCycle(): PayCycleProjection {
  return {
    startAt: null,
    endAt: null,
    startLabelSv: null,
    endLabelSv: null,
    isActive: false,
    endInferred: false,
    incomes: [],
    expenses: [],
    incomeMinor: 0,
    expenseMinor: 0,
    reservedMinor: 0,
    bufferMinor: 0,
    flexibleMinor: 0,
    savingsMinor: 0,
    freeToSpendMinor: 0,
    daysLeft: 1,
    perDayMinor: 0,
  };
}

/**
 * Active (or upcoming) pay cycle: last income → next income.
 * If next income is missing, assume same day-of-month next month.
 */
export function projectPayCycle(
  items: PlanItem[],
  now: Date,
  timeZone: string,
): PayCycleProjection {
  const dated = incomeDates(items);
  if (dated.length === 0) return emptyCycle();

  const todayMs = startOfZonedDayMs(now, timeZone);

  // Prefer latest income on/before today; else earliest future (upcoming cycle).
  const pastOrToday = dated.filter((d) => d.at <= todayMs);
  const startEntry =
    pastOrToday.length > 0
      ? pastOrToday[pastOrToday.length - 1]!
      : dated[0]!;

  const startIso = startEntry.iso;
  const startAt = startEntry.at;

  const later = dated.filter((d) => d.at > startAt);
  let endIso: string;
  let endInferred = false;
  if (later.length > 0) {
    endIso = later[0]!.iso;
  } else {
    endIso = addMonthsPreservingDay(startIso, 1);
    endInferred = true;
  }
  const endAt = Date.parse(endIso);

  const incomes = dated
    .filter((d) => d.at >= startAt && d.at < endAt)
    .filter((d) => d.item.name !== NEXT_INCOME_NAME)
    .filter((d) => isPlanIncome(d.item) || (d.item.cadence ?? "").toLowerCase() === "income")
    .map((d) => d.item);

  // Deduplicate by id
  const incomeUnique = Array.from(
    new Map(incomes.map((i) => [i.id, i])).values(),
  );
  const incomeMinor = incomeUnique.reduce((s, i) => s + i.amountMinor, 0);

  const expenses = expensesInWindow(items, startIso, endIso, timeZone);
  let reservedMinor = 0;
  let bufferMinor = 0;
  let flexibleMinor = 0;
  for (const { item } of expenses) {
    const parts = expenseAmountParts(item);
    reservedMinor += parts.reserved;
    bufferMinor += parts.buffer;
    flexibleMinor += parts.flexible;
  }
  const expenseMinor = reservedMinor + bufferMinor + flexibleMinor;

  const startMonth = monthKeyFromDate(new Date(startIso), timeZone);
  const monthProj = projectPlanForMonth(items, startMonth, timeZone);
  const savingsMinor = monthProj.savingsMinor;

  const freeToSpendMinor = incomeMinor - expenseMinor - savingsMinor;

  const isActive = startAt <= todayMs && todayMs < endAt;
  const fromMs = isActive ? todayMs : startAt;
  const daysLeft = Math.max(
    1,
    Math.ceil((endAt - fromMs) / (24 * 60 * 60 * 1000)),
  );
  const perDayMinor = perDayBudgetMinor(freeToSpendMinor, daysLeft);

  return {
    startAt: startIso,
    endAt: endIso,
    startLabelSv: labelDateSv(startIso, timeZone),
    endLabelSv: labelDateSv(endIso, timeZone),
    isActive,
    endInferred,
    incomes: incomeUnique,
    expenses,
    incomeMinor,
    expenseMinor,
    reservedMinor,
    bufferMinor,
    flexibleMinor,
    savingsMinor,
    freeToSpendMinor,
    daysLeft,
    perDayMinor,
  };
}

/** Swedish ordinal day label, e.g. `den 5:e`. */
export function labelDayOfMonthSv(day: number): string {
  const d = Math.min(31, Math.max(1, Math.floor(day)));
  if (d === 1 || d === 2) return `den ${d}:a`;
  return `den ${d}:e`;
}
