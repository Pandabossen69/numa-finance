import {
  formatIsoDateOnlySv,
  formatListDateSv,
  zonedDayAnchorMs,
  zonedDayKey,
} from "./datetime";
import type { PlanItem } from "./types";

export const PLAN_PAY_LATER_UNAVAILABLE_SV =
  "Betala senare kan inte sparas än. Databasen behöver uppdateras.";

export const PLAN_PAY_LATER_RANGE_SV =
  "Välj ett datum från idag till slutet av nästa månad.";

/** Shown when Spara would otherwise clamp a day outside the picker. */
export function payLaterRangeMessageSv(maxYmd: string): string {
  const maxLabel = formatIsoDateOnlySv(maxYmd).replace(/\.$/, "");
  return `Välj ett datum mellan idag och ${maxLabel}.`;
}

/** PostgREST / Postgres when `numa.plan_items.planned_pay_at` is not migrated yet. */
export function isMissingPlannedPayColumn(error: {
  code?: string | null;
  message?: string | null;
}): boolean {
  const code = (error.code ?? "").toUpperCase();
  const text = (error.message ?? "").toLowerCase();
  if (!text.includes("planned_pay_at")) return false;
  if (code === "PGRST204" || code === "42703") return true;
  return (
    text.includes("schema cache") ||
    text.includes("could not find") ||
    text.includes("does not exist")
  );
}

function addCalendarDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(year!, (month ?? 1) - 1, (day ?? 1) + days));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Last calendar day of the month after `ymd`'s month. */
function endOfNextMonthYmd(ymd: string): string {
  const [year, month] = ymd.split("-").map(Number);
  const nextMonthIndex = month === 12 ? 0 : month!;
  const nextYear = month === 12 ? year! + 1 : year!;
  const last = new Date(Date.UTC(nextYear, nextMonthIndex + 1, 0)).getUTCDate();
  const m = String(nextMonthIndex + 1).padStart(2, "0");
  const d = String(last).padStart(2, "0");
  return `${nextYear}-${m}-${d}`;
}

/** Inclusive picker bounds. Default is today + 3 days, clamped to the max. */
export function payLaterDateBounds(
  now: Date,
  timeZone: string,
): { min: string; max: string; defaultYmd: string } {
  const min = zonedDayKey(now, timeZone);
  const max = endOfNextMonthYmd(min);
  const plusThree = addCalendarDays(min, 3);
  const defaultYmd = plusThree > max ? max : plusThree;
  return { min, max, defaultYmd };
}

/**
 * Instant used to decide whether an unpaid bill reserves saldo.
 * `plannedPayAt` wins over the due date. A planned date before today
 * counts as today. No planned date and a due day before today reserves nothing.
 * Returns null when the bill must not reserve.
 */
export function reservePayInstant(
  dueAt: string,
  plannedPayAt: string | null | undefined,
  now: Date,
  timeZone: string,
): number | null {
  const planned = plannedPayAt?.trim() || null;
  const payAt = planned ?? dueAt;
  const payMs = Date.parse(payAt);
  if (!Number.isFinite(payMs)) return null;
  const todayAnchor = zonedDayAnchorMs(now, timeZone);
  const payDay = zonedDayAnchorMs(payAt, timeZone);
  if (payDay < todayAnchor) {
    if (!planned) return null;
    return todayAnchor;
  }
  return payMs;
}

function shortPayDaySv(iso: string, timeZone: string): string {
  return formatListDateSv(iso, timeZone).replace(/\.$/, "");
}

/**
 * Chip on an unpaid bill. Past planned dates say «Sen».
 * A date still ahead says «Sen · betalas 8 okt».
 */
export function plannedPayChipLabel(
  item: Pick<PlanItem, "plannedPayAt">,
  now: Date,
  timeZone: string,
): string | null {
  const planned = item.plannedPayAt?.trim();
  if (!planned || !Number.isFinite(Date.parse(planned))) return null;
  const payDay = zonedDayAnchorMs(planned, timeZone);
  const today = zonedDayAnchorMs(now, timeZone);
  if (payDay < today) return "Sen";
  return `Sen · betalas ${shortPayDaySv(planned, timeZone)}`;
}
