import type { PlanItem } from "./types";
import { NEXT_INCOME_NAME } from "./plan-totals";

/** Planned income for one month only (does not roll forward). */
export function isPlanIncome(item: PlanItem): boolean {
  if (item.name === NEXT_INCOME_NAME) return false;
  return (item.cadence ?? "").toLowerCase() === "income";
}

/** Mid-month anchor used to attach one-off income to a calendar month. */
export function monthAnchorIso(monthKey: string): string {
  return `${monthKey}-15T12:00:00.000Z`;
}

/** True when the bucket repeats every month until deleted. */
export function isRecurringMonthly(item: PlanItem): boolean {
  if (item.name === NEXT_INCOME_NAME) return false;
  if (isPlanIncome(item)) return false;
  const cadence = (item.cadence ?? "monthly").toLowerCase();
  return cadence === "monthly" || item.kind === "mandatory";
}

/**
 * Advance a due date forward one calendar month at a time until it is
 * on/after `now` (or return null if input invalid).
 */
export function rollDueDateForward(
  iso: string,
  now: Date = new Date(),
): string {
  const due = new Date(iso);
  if (!Number.isFinite(due.getTime())) return iso;

  const cursor = new Date(due);
  let guard = 0;
  while (cursor.getTime() < now.getTime() && guard < 120) {
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
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
  /** Fixed / planned expenses for the month (recurring + one-offs). */
  items: PlanItem[];
  /** Income rows that belong only to this month. */
  incomes: PlanItem[];
  reservedMinor: number;
  bufferMinor: number;
  flexibleMinor: number;
  incomeMinor: number;
  totalPlannedMinor: number;
};

/**
 * Project active plan buckets onto a calendar month.
 * Recurring monthly expenses always appear. One-off expenses and incomes
 * appear only when their nextDueAt falls in that month.
 */
export function projectPlanForMonth(
  items: PlanItem[],
  monthKey: string,
  timeZone: string,
): MonthPlanProjection {
  const active = items.filter(
    (i) => i.isActive && i.name !== NEXT_INCOME_NAME,
  );

  const projected: PlanItem[] = [];
  const incomes: PlanItem[] = [];

  for (const item of active) {
    if (isPlanIncome(item)) {
      if (item.nextDueAt) {
        const key = monthKeyFromDate(new Date(item.nextDueAt), timeZone);
        if (key === monthKey) incomes.push(item);
      }
      continue;
    }
    if (isRecurringMonthly(item)) {
      projected.push(item);
      continue;
    }
    if (item.nextDueAt) {
      const key = monthKeyFromDate(new Date(item.nextDueAt), timeZone);
      if (key === monthKey) projected.push(item);
    }
  }

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

  return {
    monthKey,
    labelSv: labelMonthSv(monthKey),
    items: projected,
    incomes,
    reservedMinor,
    bufferMinor,
    flexibleMinor,
    incomeMinor,
    totalPlannedMinor: reservedMinor + bufferMinor + flexibleMinor,
  };
}

export function upcomingMonthKeys(
  now: Date,
  timeZone: string,
  count = 4,
): string[] {
  const base = monthKeyFromDate(now, timeZone);
  return Array.from({ length: count }, (_, i) => addMonthsKey(base, i));
}

/** All 12 month keys for a calendar year (`2026-01` … `2026-12`). */
export function yearMonthKeys(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, "0");
    return `${year}-${mm}`;
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
