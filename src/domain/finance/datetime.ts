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

const zonedDayKeyFormatters = new Map<string, Intl.DateTimeFormat>();
const zonedHmFormatters = new Map<string, Intl.DateTimeFormat>();

function zonedDayKeyFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = zonedDayKeyFormatters.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  zonedDayKeyFormatters.set(timeZone, formatter);
  return formatter;
}

function zonedHmFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = zonedHmFormatters.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  zonedHmFormatters.set(timeZone, formatter);
  return formatter;
}

/** Absolute instant, or null when the stamp is missing or unparseable. */
function candidateInstant(stamp: string | null | undefined): Date | null {
  const trimmed = stamp?.trim();
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms);
}

/**
 * Wall clock of an instant in `timeZone`, from `Intl` parts.
 * Never slice `HH:mm` out of an offset string (`+00:00` / `Z` / `+07:00`).
 */
function wallClockHms(
  instant: Date,
  timeZone: string,
): { hh: string; mm: string; ss: string } | null {
  let hh = "";
  let mm = "";
  let ss = "";
  for (const part of zonedHmFormatter(timeZone).formatToParts(instant)) {
    if (part.type === "hour") hh = part.value;
    else if (part.type === "minute") mm = part.value;
    else if (part.type === "second") ss = part.value;
  }
  if (!/^\d{1,2}$/.test(hh) || !/^\d{1,2}$/.test(mm) || !/^\d{1,2}$/.test(ss)) {
    return null;
  }
  return {
    hh: String(Number(hh) % 24).padStart(2, "0"),
    mm: String(Number(mm)).padStart(2, "0"),
    ss: String(Number(ss)).padStart(2, "0"),
  };
}

/** `HH:mm` in `timeZone` (24h, zero-padded). Never slices an offset string. */
export function formatZonedHm(
  instant: Date | string,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const date = instant instanceof Date ? instant : new Date(instant);
  const clock = wallClockHms(date, timeZone);
  if (!clock) return "";
  return `${clock.hh}:${clock.mm}`;
}

/** Keep `iso` when it is at or before `now`; otherwise now − 2s. */
export function clampOccurredAt(iso: string, now: Date): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms) || ms <= now.getTime()) return iso;
  return new Date(now.getTime() - 2_000).toISOString();
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
  return zonedDayKeyFormatter(timeZone).format(d);
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

/** Calendar day (`YYYY-MM-DD`) of an instant in `timeZone`. */
export function calendarDateInZone(
  instant: Date | string,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  return zonedDayKey(instant, timeZone);
}

/**
 * Absolute instant for a review calendar day in `timeZone`.
 *
 * A candidate stamp is one instant. Its local day and clock come from
 * `Intl` in `timeZone`, never from the `HH:mm` digits of a `+00:00` / `Z`
 * string. Reading those digits as Bangkok time stored "25 sep. 2026 11:02"
 * (`2026-09-25T04:02:00+00:00`) as `2026-09-24T21:02Z`, seven hours early.
 *
 * The same local day keeps that instant. A different chosen day keeps the
 * local clock on the chosen day. No time: today and any future day are
 * `now − 2s`; an earlier day stays at 12:00 local. Nothing is after `now`.
 */
export function occurredAtOnCalendarDay(input: {
  ymd: string;
  keepTimeFrom?: string | null;
  timeZone?: string;
  now?: Date;
}): string {
  const timeZone = input.timeZone ?? DEFAULT_TIMEZONE;
  const now = input.now ?? new Date();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.ymd)) {
    throw new Error("Ogiltigt datum");
  }
  const instant = candidateInstant(input.keepTimeFrom);
  const today = zonedDayKey(now, timeZone);
  let iso: string;
  if (instant) {
    const localDay = zonedDayKey(instant, timeZone);
    if (input.ymd === localDay) {
      iso = instant.toISOString();
    } else {
      const clock = wallClockHms(instant, timeZone);
      iso = clock
        ? zonedWallTimeToUtcIso(
            `${input.ymd}T${clock.hh}:${clock.mm}:${clock.ss}`,
            timeZone,
          )
        : instant.toISOString();
    }
  } else if (input.ymd === today || input.ymd > today) {
    iso = new Date(now.getTime() - 2_000).toISOString();
  } else {
    iso = zonedWallTimeToUtcIso(`${input.ymd}T12:00`, timeZone);
  }
  return clampOccurredAt(iso, now);
}

/** Latest calendar day a movement may use: today in `timeZone`, never tomorrow. */
export function maxBookableCalendarDate(
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  return calendarDateInZone(now, timeZone);
}

/**
 * `occurred_at` for a date the user picked.
 *
 * The civil day is the calendar day in `timeZone` (profile default
 * Asia/Bangkok), not the UTC date of the host. A future day is clamped to
 * today so the stored instant cannot land on tomorrow.
 */
export function occurredAtForBookedDay(input: {
  ymd: string;
  timeZone?: string;
  now?: Date;
  keepTimeFrom?: string | null;
}): string {
  const timeZone = input.timeZone || DEFAULT_TIMEZONE;
  const now = input.now ?? new Date();
  const today = maxBookableCalendarDate(now, timeZone);
  const raw = input.ymd.trim();
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? (raw > today ? today : raw) : today;
  return occurredAtOnCalendarDay({
    ymd,
    timeZone,
    now,
    keepTimeFrom: input.keepTimeFrom,
  });
}

/**
 * Interpret a naive wall-clock `YYYY-MM-DDTHH:mm[:ss]` as local time in
 * `timeZone` and return an absolute ISO string. Prevents evening Bangkok
 * times from shifting to the next calendar day on UTC hosts.
 *
 * Asia/Bangkok (no DST) keeps an explicit `+07:00` so fingerprints that
 * truncate to wall-clock minute stay stable across imports.
 */
export function zonedWallTimeToUtcIso(
  wallLocal: string,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const m = wallLocal
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) {
    const parsed = Date.parse(wallLocal);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Ogiltig lokal tid: ${wallLocal}`);
    }
    return new Date(parsed).toISOString();
  }
  const wall = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? "00"}`;
  if (timeZone === "Asia/Bangkok") {
    return `${wall}+07:00`;
  }
  const asLocalComponents = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6] ?? "0"),
  );
  return fromZonedTime(asLocalComponents, timeZone).toISOString();
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
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const hours = (now.getTime() - Date.parse(verifiedAt)) / (1000 * 60 * 60);
  const civilDays = calendarDaysBetween(verifiedAt, now, timeZone);
  if (civilDays <= 0 || hours < 24) {
    if (hours < 1) {
      const minutes = Math.max(1, Math.round(hours * 60));
      return `${minutes} ${pluralSv(minutes, "minut", "minuter")} sedan`;
    }
    const h = Math.max(1, Math.round(hours));
    return `${h} ${pluralSv(h, "timme", "timmar")} sedan`;
  }
  return `${civilDays} ${pluralSv(civilDays, "dag", "dagar")} sedan`;
}

/** Swedish count label, e.g. `1 dag` / `12 dagar`. */
export function formatCountSv(n: number, one: string, many: string): string {
  const count = Math.max(0, Math.floor(n));
  return `${count} ${pluralSv(count, one, many)}`;
}

/** Days until a horizon: `idag` / `1 dag kvar` / `4 dagar kvar`. */
export function formatDaysUntilSv(days: number): string {
  const count = Math.max(0, Math.floor(days));
  if (count <= 0) return "idag";
  return `${formatCountSv(count, "dag", "dagar")} kvar`;
}

/** Earliest valid instant among ISO strings / Dates. */
export function earliestInstant(
  ...values: Array<string | Date | null | undefined>
): Date | null {
  let min = Infinity;
  for (const value of values) {
    if (value == null || value === "") continue;
    const ms = value instanceof Date ? value.getTime() : Date.parse(value);
    if (!Number.isFinite(ms)) continue;
    if (ms < min) min = ms;
  }
  return Number.isFinite(min) ? new Date(min) : null;
}

/**
 * Ledger fetch window for Hem/Analys snapshots.
 *
 * Spend totals only need txs from month/cycle start. Saldo needs every tx
 * after the latest checkpoint — refetch when that checkpoint is older.
 */
export function snapshotLedgerWindow(params: {
  monthStart: Date | string;
  cycleStartAt?: string | null;
  checkpointVerifiedAt?: string | null;
  /** Inclusive lower bound for historical month closeouts (extra saldo). */
  historySince?: Date | string | null;
}): {
  spendSinceIso: string;
  saldoSinceIso: string;
  refetchFromCheckpoint: boolean;
} {
  const spend = earliestInstant(
    params.monthStart,
    params.cycleStartAt,
    params.historySince,
  );
  if (!spend) {
    throw new Error("monthStart krävs för snapshot-fönster");
  }
  const spendSinceIso = spend.toISOString();
  const checkpointMs = params.checkpointVerifiedAt
    ? Date.parse(params.checkpointVerifiedAt)
    : NaN;
  const refetchFromCheckpoint =
    Number.isFinite(checkpointMs) && checkpointMs < spend.getTime();
  return {
    spendSinceIso,
    saldoSinceIso: refetchFromCheckpoint
      ? params.checkpointVerifiedAt!
      : spendSinceIso,
    refetchFromCheckpoint,
  };
}

const listDateFormatters = new Map<string, Intl.DateTimeFormat>();

function listDateFormatter(
  timeZone: string,
  withTime: boolean,
): Intl.DateTimeFormat {
  const key = `${withTime ? "t" : "d"}\0${timeZone}`;
  const cached = listDateFormatters.get(key);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
  listDateFormatters.set(key, formatter);
  return formatter;
}

/** List dates in Swedish locale — never US `M/D/YYYY`. */
export function formatListDateSv(
  iso: string,
  timeZone: string,
  opts?: { withTime?: boolean },
): string {
  return listDateFormatter(timeZone, opts?.withTime === true).format(
    new Date(iso),
  );
}

const CALENDAR_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a committed `<input type="date">` value (`YYYY-MM-DD`). */
export function isCalendarDate(value: string): boolean {
  return CALENDAR_DATE_RE.test(value.trim());
}

/**
 * Next `YYYY-MM-DD` to store from a date input. Ignores empty, partial, and
 * unchanged values so the field cannot snap back or clear while picking.
 */
export function nextCommittedCalendarDate(
  raw: string,
  current: string,
): string | null {
  const next = raw.trim();
  if (!isCalendarDate(next) || next === current) return null;
  return next;
}

/**
 * `YYYY-MM-DD` for `<input type="date">` from a stored ISO instant or date-only.
 * Uses the civil day in `timeZone` — never `toISOString().slice(0, 10)`, which
 * is the previous UTC date for most of a Bangkok morning.
 */
export function isoToDateInput(
  iso: string | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  if (!iso) return "";
  const trimmed = iso.trim();
  if (isCalendarDate(trimmed)) return trimmed;
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return "";
  return zonedDayKey(trimmed, timeZone);
}

/** Calendar `YYYY-MM-DD` as `28 aug.` — no US locale, no timezone shift. */
export function formatIsoDateOnlySv(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return isoDate;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleString("sv-SE", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  });
}
