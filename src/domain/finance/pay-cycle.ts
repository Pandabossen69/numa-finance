import type { PlanItem } from "./types";
import { calendarDaysBetween, zonedDayAnchorMs } from "./datetime";
import { NEXT_INCOME_NAME } from "./plan-totals";
import {
  addMonthsKey,
  daysInMonthKey,
  isPlanIncome,
  isPlanSavings,
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

export type PayCyclePhase = "pre" | "partial" | "full";

export type PayCycleProjection = {
  /**
   * Inclusive window start for the active phase:
   * - pre: first income of the upcoming wave (bridge target)
   * - partial: first income of the funding wave
   * - full: last income of the funding wave
   */
  startAt: string | null;
  /**
   * Exclusive window end:
   * - partial: last income of this funding month
   * - full / pre labels: last income of the next month
   */
  endAt: string | null;
  startLabelSv: string | null;
  endLabelSv: string | null;
  /** Funding calendar month for the income pool (`2026-08`). */
  fundingMonthKey: string | null;
  /** pre = before first income; partial = early incomes landed; full = last→next last. */
  phase: PayCyclePhase | null;
  /** True when the plan pool is driving Hem (partial or full). */
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
 * Expense rows whose actual nextDueAt falls in [start, end).
 * Fixed monthly expenses are month-scoped — they are never synthesized
 * into other months of the window.
 */
export function expensesInWindow(
  items: PlanItem[],
  startIso: string,
  endIso: string,
): CycleExpense[] {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return [];
  }

  const result: CycleExpense[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (!item.isActive || item.name === NEXT_INCOME_NAME) continue;
    if (isPlanIncome(item) || isPlanSavings(item)) continue;
    if (!item.nextDueAt) continue;

    const t = Date.parse(item.nextDueAt);
    if (t >= start && t < end) {
      const key = `${item.id}:${item.nextDueAt}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ item, dueAt: item.nextDueAt });
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
    phase: null,
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

function resolveNextLastIso(
  byMonth: Map<string, DatedIncome[]>,
  fundingMonthKey: string,
  lastFundingIso: string,
): { endIso: string; endInferred: boolean } {
  let cursor = addMonthsKey(fundingMonthKey, 1);
  for (let i = 0; i < 24; i++) {
    const nextWave = byMonth.get(cursor);
    if (nextWave && nextWave.length > 0) {
      return {
        endIso: nextWave[nextWave.length - 1]!.iso,
        endInferred: false,
      };
    }
    cursor = addMonthsKey(cursor, 1);
  }
  return {
    endIso: addMonthsPreservingDay(lastFundingIso, 1),
    endInferred: true,
  };
}

function sumExpenseParts(expenses: CycleExpense[]) {
  let reservedMinor = 0;
  let bufferMinor = 0;
  let flexibleMinor = 0;
  for (const { item } of expenses) {
    const parts = expenseAmountParts(item);
    reservedMinor += parts.reserved;
    bufferMinor += parts.buffer;
    flexibleMinor += parts.flexible;
  }
  return {
    reservedMinor,
    bufferMinor,
    flexibleMinor,
    expenseMinor: reservedMinor + bufferMinor + flexibleMinor,
  };
}

/**
 * Living cycle funded by a calendar month's income wave.
 *
 * Phases (example: Alltid ID 23rd + CSN/Trukks 25th → next last 25 Sep):
 * - pre: before first income → Hem uses kontosaldo until 23rd
 * - partial: early income landed → only landed amounts, days until THIS
 *   month's last (25th) so kvar/dag is higher for the short stretch
 * - full: last income landed → full month pool until NEXT month's last
 *
 * Funding month stays sticky until that wave's nextLast passes, so an early
 * income next month does not steal the open full cycle.
 */
export function projectPayCycle(
  items: PlanItem[],
  now: Date,
  timeZone: string,
): PayCycleProjection {
  const dated = realIncomeDates(items, timeZone);
  if (dated.length === 0) return emptyCycle();

  const byMonth = groupByMonth(dated);
  const todayMs = zonedDayAnchorMs(now, timeZone);
  const pastOrToday = dated.filter((d) => d.at <= todayMs);

  const fundingMonthKey = pickFundingMonthKey(
    byMonth,
    dated,
    pastOrToday,
    todayMs,
  );
  const wave = byMonth.get(fundingMonthKey) ?? [];
  if (wave.length === 0) return emptyCycle();

  const first = wave[0]!;
  const last = wave[wave.length - 1]!;
  const { endIso: nextLastIso, endInferred } = resolveNextLastIso(
    byMonth,
    fundingMonthKey,
    last.iso,
  );

  const phase: PayCyclePhase =
    todayMs < first.at ? "pre" : todayMs < last.at ? "partial" : "full";

  let startIso: string;
  let endIso: string;
  let incomeRows: DatedIncome[];
  let expenseStartIso: string;
  let expenseEndIso: string;
  let savingsMinor = 0;
  let isActive = false;

  if (phase === "pre") {
    // Bridge until first paycheck — pool not open yet.
    startIso = first.iso;
    endIso = nextLastIso;
    incomeRows = wave;
    expenseStartIso = first.iso;
    expenseEndIso = nextLastIso;
    isActive = false;
  } else if (phase === "partial") {
    // Early incomes count now; runway ends at this month's last payment.
    startIso = first.iso;
    endIso = last.iso;
    incomeRows = wave.filter((d) => d.at <= todayMs);
    expenseStartIso = first.iso;
    expenseEndIso = last.iso;
    // Don't pull full-month savings into a 1–2 day stretch.
    savingsMinor = 0;
    isActive = true;
  } else {
    // Last payment landed — full pool from first income until next month's last.
    // Keep start at first so mid-wave spend/expenses stay in the same window.
    startIso = first.iso;
    endIso = nextLastIso;
    incomeRows = wave;
    expenseStartIso = first.iso;
    expenseEndIso = nextLastIso;
    savingsMinor = projectPlanForMonth(
      items,
      fundingMonthKey,
      timeZone,
    ).savingsMinor;
    isActive = todayMs < Date.parse(nextLastIso);
  }

  const incomeUnique = Array.from(
    new Map(incomeRows.map((d) => [d.item.id, d.item])).values(),
  );
  const incomeMinor = incomeUnique.reduce((s, i) => s + i.amountMinor, 0);

  const expenses = expensesInWindow(
    items,
    expenseStartIso,
    expenseEndIso,
  );
  const { reservedMinor, bufferMinor, flexibleMinor, expenseMinor } =
    sumExpenseParts(expenses);
  const freeToSpendMinor = incomeMinor - expenseMinor - savingsMinor;

  const fromIso = isActive ? now.toISOString() : startIso;
  const daysLeft = Math.max(1, calendarDaysBetween(fromIso, endIso, timeZone));
  const perDayMinor = perDayBudgetMinor(freeToSpendMinor, daysLeft);

  return {
    startAt: startIso,
    endAt: endIso,
    startLabelSv: labelDateSv(startIso, timeZone),
    endLabelSv: labelDateSv(endIso, timeZone),
    fundingMonthKey,
    phase,
    isActive,
    endInferred: phase === "partial" ? false : endInferred,
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

/**
 * Prefer an open full wave (last landed, nextLast still ahead) so early income
 * in the next calendar month cannot steal funding mid-cycle.
 */
function pickFundingMonthKey(
  byMonth: Map<string, DatedIncome[]>,
  dated: DatedIncome[],
  pastOrToday: DatedIncome[],
  todayMs: number,
): string {
  const monthKeys = Array.from(byMonth.keys()).sort();
  for (let i = monthKeys.length - 1; i >= 0; i--) {
    const key = monthKeys[i]!;
    const wave = byMonth.get(key);
    if (!wave || wave.length === 0) continue;
    const last = wave[wave.length - 1]!;
    if (last.at > todayMs) continue;
    const { endIso } = resolveNextLastIso(byMonth, key, last.iso);
    if (todayMs < Date.parse(endIso)) {
      return key;
    }
  }

  if (pastOrToday.length > 0) {
    return pastOrToday[pastOrToday.length - 1]!.monthKey;
  }
  return dated[0]!.monthKey;
}

/** Swedish ordinal day label, e.g. `den 5:e`. */
export function labelDayOfMonthSv(day: number): string {
  const d = Math.min(31, Math.max(1, Math.floor(day)));
  if (d === 1 || d === 2) return `den ${d}:a`;
  return `den ${d}:e`;
}
