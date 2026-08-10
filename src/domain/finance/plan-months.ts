import type { PlanItem } from "./types";
import { NEXT_INCOME_NAME } from "./plan-totals";

/** True when the bucket repeats every month until deleted. */
export function isRecurringMonthly(item: PlanItem): boolean {
  if (item.name === NEXT_INCOME_NAME) return false;
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
  items: PlanItem[];
  reservedMinor: number;
  bufferMinor: number;
  flexibleMinor: number;
  totalPlannedMinor: number;
};

/**
 * Project active plan buckets onto a calendar month.
 * Recurring monthly items always appear. One-off / dated items appear when
 * their nextDueAt falls in that month.
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
  for (const item of active) {
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

  return {
    monthKey,
    labelSv: labelMonthSv(monthKey),
    items: projected,
    reservedMinor,
    bufferMinor,
    flexibleMinor,
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
