import {
  calendarDateInZone,
  DEFAULT_TIMEZONE,
  occurredAtOnCalendarDay,
} from "@/domain/finance/datetime";

export { occurredAtOnCalendarDay };

/** YYYY-MM-DD for the review date input. Newest known stamp, else today. */
export function suggestedCaptureDate(
  stamps: readonly (string | null | undefined)[],
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  let best: string | null = null;
  for (const stamp of stamps) {
    if (!stamp) continue;
    const ymd = calendarDateInZone(stamp, timeZone);
    if (!ymd) continue;
    if (!best || ymd > best) best = ymd;
  }
  return best ?? calendarDateInZone(now, timeZone);
}

/**
 * Send a calendar day when it is the only movement, a receipt, or the user
 * changed the date. A multi-row import keeps each row's own timestamp until
 * the date field is edited.
 */
export function occurredOnForConfirm(input: {
  isAutoImport: boolean;
  eventCount: number;
  suggestedOn: string;
  editedOn: string;
}): string | null {
  const edited = input.editedOn !== input.suggestedOn;
  if (!input.isAutoImport || input.eventCount <= 1 || edited) {
    return input.editedOn;
  }
  return null;
}

/** Calendar day from the review, otherwise the row's own timestamp. */
export function confirmOccurredAt(input: {
  occurredOn?: string | null;
  candidateOccurredAt?: string | null;
  fallbackIso: string;
  timeZone?: string | null;
}): string {
  const ymd = input.occurredOn?.trim();
  if (!ymd) return input.fallbackIso;
  return occurredAtOnCalendarDay({
    ymd,
    keepTimeFrom: input.candidateOccurredAt,
    timeZone: input.timeZone || DEFAULT_TIMEZONE,
  });
}
