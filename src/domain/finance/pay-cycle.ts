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
  /** Inclusive cycle start (first income in the funding month). */
  startAt: string | null;
  /** Exclusive cycle end (last income next month — when new pool arrives). */
  endAt: string | null;
  startLabelSv: string | null;
  endLabelSv: string | null;
  /** Funding calendar month for the income pool (`2026-08`). */
  fundingMonthKey: string | null;
  /** True when start ≤ now < end. */
  isActive: boolean;
  /** True when cycle end was assumed (+1 month from last funding income). */
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

type DatedIncome = { item: PlanItem; at: number; iso: string; monthKey: string };

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
  return Date.parse(`${y}-${m}-${d}T12:00:00.000Z`);
}

function isRealIncome(item: PlanItem): boolean {
  if (item.name === NEXT_INCOME_NAME) return false;
  return (
    isPlanIncome(item) || (item.cadence ?? "").toLowerCase() === "income"
  );
}

/** Planned paycheck incomes only (amounts that fund the living pool). */
function realIncomeDates(
  items: PlanItem[],
  timeZone: string,
): DatedIncome[] {
  const out: DatedIncome[] = [];
  for (const item of items) {
    if (!item.isActive || !item.nextDueAt || !isRealIncome(item)) continue;
    const at = Date.parse(item.nextDueAt);
    if (!Number.isFinite(at)) continue;
    out.push({
      item,
      at,
      iso: item.nextDueAt,
      monthKey: monthKeyFromDate(new Date(item.nextDueAt), timeZone),
    });
  }
  out.sort((a, b) => a.at - b.at || a.item.name.localeCompare(b.item.name));
  return out;
}

function groupByMonth(dated: DatedIncome[]): Map<string, DatedIncome[]> {
  const map = new Map<string, DatedIncome[]>();
  for (const row of dated) {
    const list = map.get(row.monthKey) ?? [];
    list.push(row);
    map.set(row.monthKey, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.at - b.at);
  }
  return map;
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
    fundingMonthKey: null,
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
 * Living cycle funded by a calendar month's income wave.
 *
 * Example: Alltid ID 23rd + CSN/Trukks 25th in August are ONE pool.
 * That pool covers fixed/extra costs until the last income next month
 * (when the next pool arrives) — leftover ÷ days = personal daily budget.
 */
export function projectPayCycle(
  items: PlanItem[],
  now: Date,
  timeZone: string,
): PayCycleProjection {
  const dated = realIncomeDates(items, timeZone);
  if (dated.length === 0) return emptyCycle();

  const byMonth = groupByMonth(dated);
  const todayMs = startOfZonedDayMs(now, timeZone);

  const pastOrToday = dated.filter((d) => d.at <= todayMs);
  const fundingMonthKey =
    pastOrToday.length > 0
      ? pastOrToday[pastOrToday.length - 1]!.monthKey
      : dated[0]!.monthKey;

  const wave = byMonth.get(fundingMonthKey) ?? [];
  if (wave.length === 0) return emptyCycle();

  const startIso = wave[0]!.iso;
  const startAt = wave[0]!.at;
  const lastFundingIso = wave[wave.length - 1]!.iso;

  // Next month that has planned incomes → end at that month's LAST income.
  let endIso: string;
  let endInferred = false;
  let cursor = addMonthsKey(fundingMonthKey, 1);
  let foundNext = false;
  for (let i = 0; i < 24; i++) {
    const nextWave = byMonth.get(cursor);
    if (nextWave && nextWave.length > 0) {
      endIso = nextWave[nextWave.length - 1]!.iso;
      foundNext = true;
      break;
    }
    cursor = addMonthsKey(cursor, 1);
  }
  if (!foundNext) {
    endIso = addMonthsPreservingDay(lastFundingIso, 1);
    endInferred = true;
  }
  const endAt = Date.parse(endIso!);

  const incomeUnique = Array.from(
    new Map(wave.map((d) => [d.item.id, d.item])).values(),
  );
  const incomeMinor = incomeUnique.reduce((s, i) => s + i.amountMinor, 0);

  const expenses = expensesInWindow(items, startIso, endIso!, timeZone);
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

  const monthProj = projectPlanForMonth(items, fundingMonthKey, timeZone);
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
    endAt: endIso!,
    startLabelSv: labelDateSv(startIso, timeZone),
    endLabelSv: labelDateSv(endIso!, timeZone),
    fundingMonthKey,
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
