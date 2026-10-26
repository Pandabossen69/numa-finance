import { calendarDaysBetween, zonedDayKey } from "@/domain/finance/datetime";
import type { HomeSnapshot } from "@/features/finance/load-home";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function timeZoneOf(snap: HomeSnapshot): string {
  return snap.timeZone || "Asia/Bangkok";
}

/**
 * Days from the cache stamp until its horizon. `spendDaysLeft` is the
 * horizon distance on `verifiedAt` (0 = that civil day). Negative means
 * the horizon is already behind `now`.
 */
export function cachedHorizonDaysRemaining(
  snap: HomeSnapshot,
  now = new Date(),
): number | null {
  if (!snap.verifiedAt) return null;
  const elapsed = calendarDaysBetween(snap.verifiedAt, now, timeZoneOf(snap));
  return snap.spendDaysLeft - elapsed;
}

export function homeCacheIsOtherCivilDay(
  snap: HomeSnapshot,
  now = new Date(),
): boolean {
  if (!snap.verifiedAt) return false;
  const tz = timeZoneOf(snap);
  return zonedDayKey(snap.verifiedAt, tz) !== zonedDayKey(now, tz);
}

function closedEnvelope(snap: HomeSnapshot, otherDay: boolean): HomeSnapshot {
  return {
    ...snap,
    dayEnvelopeOpen: false,
    dayEnvelopePending: false,
    dayBudgetMinor: 0,
    remainingTodayMinor: 0,
    safeToSpendTodayMinor: 0,
    spendDaysLeft: 0,
    daysUntilIncome: 0,
    todaySpendingMinor: otherDay ? 0 : snap.todaySpendingMinor,
  };
}

function pendingEnvelope(snap: HomeSnapshot): HomeSnapshot {
  return {
    ...snap,
    dayEnvelopePending: true,
    dayBudgetMinor: 0,
    remainingTodayMinor: 0,
    safeToSpendTodayMinor: 0,
    todaySpendingMinor: 0,
  };
}

/**
 * Paint copy of a Hem cache. A shell from another Bangkok day must not
 * show that day's Kvar. A passed horizon becomes «Perioden är slut».
 * An open horizon waits as a skeleton. Same-day numbers stay.
 * Empty (no income at all) is left alone.
 */
export function homeCacheDayEnvelope(
  snap: HomeSnapshot,
  now = new Date(),
): HomeSnapshot {
  if (snap.livingMode === "empty") return snap;
  const tz = timeZoneOf(snap);
  const today = zonedDayKey(now, tz);
  if (snap.envelopeDayKey === today) return snap;

  if (snap.dayEnvelopeOpen === false) {
    if (
      snap.dayBudgetMinor === 0 &&
      snap.remainingTodayMinor === 0 &&
      snap.dayEnvelopePending !== true
    ) {
      return snap;
    }
    return closedEnvelope(snap, homeCacheIsOtherCivilDay(snap, now));
  }

  const otherDay = homeCacheIsOtherCivilDay(snap, now);
  if (!otherDay) return snap;

  const horizonLeft = cachedHorizonDaysRemaining(snap, now);
  if (horizonLeft != null && horizonLeft < 0) {
    return closedEnvelope(snap, true);
  }
  return pendingEnvelope(snap);
}

/** Milliseconds until the next local midnight in `timeZone` (at least 1s). */
export function msUntilNextZonedMidnight(
  now = new Date(),
  timeZone = "Asia/Bangkok",
): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const num = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  let hour = num("hour");
  if (hour === 24) hour = 0;
  const elapsed = ((hour * 60 + num("minute")) * 60 + num("second")) * 1000;
  const remain = MS_PER_DAY - elapsed;
  return Math.max(1000, remain);
}
