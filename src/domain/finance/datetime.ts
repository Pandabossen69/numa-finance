import { toZonedTime, fromZonedTime } from "date-fns-tz";
import {
  endOfDay,
  endOfMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";

export const DEFAULT_TIMEZONE = "Asia/Bangkok";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function zonedNow(timezone: string = DEFAULT_TIMEZONE, now = new Date()): Date {
  return toZonedTime(now, timezone);
}

export function startOfZonedDay(
  date: Date,
  timezone: string = DEFAULT_TIMEZONE,
): Date {
  const zoned = toZonedTime(date, timezone);
  return fromZonedTime(startOfDay(zoned), timezone);
}

export function endOfZonedDay(
  date: Date,
  timezone: string = DEFAULT_TIMEZONE,
): Date {
  const zoned = toZonedTime(date, timezone);
  return fromZonedTime(endOfDay(zoned), timezone);
}

export function startOfZonedMonth(
  date: Date,
  timezone: string = DEFAULT_TIMEZONE,
): Date {
  const zoned = toZonedTime(date, timezone);
  return fromZonedTime(startOfMonth(zoned), timezone);
}

export function endOfZonedMonth(
  date: Date,
  timezone: string = DEFAULT_TIMEZONE,
): Date {
  const zoned = toZonedTime(date, timezone);
  return fromZonedTime(endOfMonth(zoned), timezone);
}

export function startOfZonedWeek(
  date: Date,
  timezone: string = DEFAULT_TIMEZONE,
): Date {
  const zoned = toZonedTime(date, timezone);
  return fromZonedTime(startOfWeek(zoned, { weekStartsOn: 1 }), timezone);
}

export function endOfZonedWeek(
  date: Date,
  timezone: string = DEFAULT_TIMEZONE,
): Date {
  const zoned = toZonedTime(date, timezone);
  return fromZonedTime(endOfWeek(zoned, { weekStartsOn: 1 }), timezone);
}

export function isSameZonedDay(
  a: Date | string,
  b: Date | string,
  timezone: string = DEFAULT_TIMEZONE,
): boolean {
  return zonedDayKey(a, timezone) === zonedDayKey(b, timezone);
}

/**
 * Calendar day key (`YYYY-MM-DD`) in the given IANA timezone.
 * Never derive this from `Date#toISOString().slice(0, 10)` — for Asia/Bangkok
 * that returns the previous UTC date for most of the local morning.
 */
export function zonedDayKey(
  date: Date | string,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Stable noon-UTC anchor for the calendar day of `date` in `timeZone`.
 * Used for whole-day arithmetic (pay-cycle / bridge days left).
 */
export function zonedDayAnchorMs(
  date: Date | string,
  timeZone: string = DEFAULT_TIMEZONE,
): number {
  return Date.parse(`${zonedDayKey(date, timeZone)}T12:00:00.000Z`);
}

/** Whole calendar days from `from` to `to` in `timeZone` (can be negative). */
export function calendarDaysBetween(
  from: Date | string,
  to: Date | string,
  timeZone: string = DEFAULT_TIMEZONE,
): number {
  const fromMs = zonedDayAnchorMs(from, timeZone);
  const toMs = zonedDayAnchorMs(to, timeZone);
  return Math.round((toMs - fromMs) / MS_PER_DAY);
}

function pluralSv(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function formatRelativeVerificationSv(
  verifiedAt: string,
  now = new Date(),
): string {
  const hours = (now.getTime() - Date.parse(verifiedAt)) / (1000 * 60 * 60);
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(hours * 60));
    return `${minutes} ${pluralSv(minutes, "minut", "minuter")} sedan`;
  }
  if (hours < 24) {
    const h = Math.round(hours);
    return `${h} ${pluralSv(h, "timme", "timmar")} sedan`;
  }
  const days = Math.round(hours / 24);
  return `${days} ${pluralSv(days, "dag", "dagar")} sedan`;
}

/** Swedish count label, e.g. `1 dag` / `12 dagar`. */
export function formatCountSv(n: number, one: string, many: string): string {
  const count = Math.max(0, Math.floor(n));
  return `${count} ${pluralSv(count, one, many)}`;
}
