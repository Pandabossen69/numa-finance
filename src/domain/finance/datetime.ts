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
  const da = toZonedTime(typeof a === "string" ? new Date(a) : a, timezone);
  const db = toZonedTime(typeof b === "string" ? new Date(b) : b, timezone);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function formatRelativeVerificationSv(
  verifiedAt: string,
  now = new Date(),
): string {
  const hours = (now.getTime() - Date.parse(verifiedAt)) / (1000 * 60 * 60);
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(hours * 60));
    return `Senast verifierat för ${minutes} min sedan`;
  }
  if (hours < 24) {
    const h = Math.round(hours);
    return `Senast verifierat för ${h} timmar sedan`;
  }
  const days = Math.round(hours / 24);
  return `Senast verifierat för ${days} dagar sedan`;
}
