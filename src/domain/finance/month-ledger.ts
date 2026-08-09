import { addMonths, format } from "date-fns";
import { sv } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import type { CurrencyCode } from "@/domain/money";
import { money, type Money } from "@/domain/money";
import {
  appliesToIncome,
  appliesToSpending,
} from "./balance";
import {
  endOfZonedMonth,
  startOfZonedMonth,
  DEFAULT_TIMEZONE,
} from "./datetime";
import type { CanonicalTransaction } from "./types";

export type MonthKey = `${number}-${string}`; // YYYY-MM

export type MonthSummary = {
  monthKey: MonthKey;
  labelSv: string;
  spending: Money;
  income: Money;
  net: Money;
  movementCount: number;
  byDay: Array<{
    dayKey: string;
    labelSv: string;
    transactions: CanonicalTransaction[];
  }>;
};

export function parseMonthKey(
  value: string | null | undefined,
  timezone = DEFAULT_TIMEZONE,
  now = new Date(),
): MonthKey {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    return value as MonthKey;
  }
  const zoned = toZonedTime(now, timezone);
  return format(zoned, "yyyy-MM") as MonthKey;
}

export function shiftMonthKey(monthKey: MonthKey, delta: number): MonthKey {
  const [y, m] = monthKey.split("-").map(Number);
  const base = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
  return format(addMonths(base, delta), "yyyy-MM") as MonthKey;
}

export function monthKeyLabelSv(monthKey: MonthKey): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y!, (m ?? 1) - 1, 1);
  const label = format(d, "MMMM yyyy", { locale: sv });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function monthBounds(
  monthKey: MonthKey,
  timezone = DEFAULT_TIMEZONE,
): { start: Date; end: Date } {
  const [y, m] = monthKey.split("-").map(Number);
  // Noon UTC mid-month avoids DST edge noise when converting zones.
  const anchor = new Date(Date.UTC(y!, (m ?? 1) - 1, 15, 12));
  return {
    start: startOfZonedMonth(anchor, timezone),
    end: endOfZonedMonth(anchor, timezone),
  };
}

export function sumIncome(
  transactions: CanonicalTransaction[],
  currency: CurrencyCode,
): Money {
  let total = 0;
  for (const tx of transactions) {
    if (!appliesToIncome(tx)) continue;
    if (tx.currency !== currency) continue;
    total += tx.amountMinor;
  }
  return money(total, currency);
}

export function buildMonthSummary(params: {
  transactions: CanonicalTransaction[];
  monthKey: MonthKey;
  currency: CurrencyCode;
  timezone?: string;
}): MonthSummary {
  const timezone = params.timezone ?? DEFAULT_TIMEZONE;
  const { start, end } = monthBounds(params.monthKey, timezone);
  const startMs = start.getTime();
  const endMs = end.getTime();

  const inMonth = params.transactions
    .filter((tx) => {
      if (tx.status === "voided") return false;
      const t = Date.parse(tx.occurredAt);
      return t >= startMs && t <= endMs;
    })
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));

  const spending = params.transactions
    .filter((tx) => {
      const t = Date.parse(tx.occurredAt);
      return t >= startMs && t <= endMs;
    })
    .reduce(
      (acc, tx) =>
        appliesToSpending(tx) && tx.currency === params.currency
          ? acc + tx.amountMinor
          : acc,
      0,
    );

  const incomeMinor = params.transactions
    .filter((tx) => {
      const t = Date.parse(tx.occurredAt);
      return t >= startMs && t <= endMs;
    })
    .reduce(
      (acc, tx) =>
        appliesToIncome(tx) && tx.currency === params.currency
          ? acc + tx.amountMinor
          : acc,
      0,
    );

  const dayMap = new Map<string, CanonicalTransaction[]>();
  for (const tx of inMonth) {
    const zoned = toZonedTime(new Date(tx.occurredAt), timezone);
    const dayKey = format(zoned, "yyyy-MM-dd");
    const list = dayMap.get(dayKey) ?? [];
    list.push(tx);
    dayMap.set(dayKey, list);
  }

  const byDay = [...dayMap.entries()].map(([dayKey, transactions]) => {
    const d = new Date(`${dayKey}T12:00:00`);
    return {
      dayKey,
      labelSv: format(d, "EEEE d MMM", { locale: sv }),
      transactions,
    };
  });

  return {
    monthKey: params.monthKey,
    labelSv: monthKeyLabelSv(params.monthKey),
    spending: money(spending, params.currency),
    income: money(incomeMinor, params.currency),
    net: money(incomeMinor - spending, params.currency),
    movementCount: inMonth.length,
    byDay,
  };
}

export function monthOutcomeCopy(summary: MonthSummary): string {
  if (summary.movementCount === 0) {
    return "Inga rörelser den här månaden ännu — lägg till via + så börjar historiken.";
  }
  if (summary.net.amountMinor > 0) {
    return "Månaden går plus hittills — inkomsterna väger tyngre än utgifterna.";
  }
  if (summary.net.amountMinor < 0) {
    return "Månaden går minus hittills — mer ut än in. Det går att vända.";
  }
  return "In och ut tar ut varandra den här månaden.";
}
