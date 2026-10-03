import { DEFAULT_TIMEZONE, formatZonedHm } from "@/domain/finance/datetime";

/** Hourly cap on saved uploads. Model errors, empty/unknown reads, and timeouts do not count. */
export const UPLOAD_HOURLY_IMAGE_LIMIT = 20;

export const UPLOAD_RATE_LIMIT_CODE = "upload_rate_limit" as const;

const HOUR_MS = 60 * 60 * 1000;

/** When the rolling window opens again: oldest observation in the window + 1 hour. */
export function uploadRateLimitRetryAt(oldestCreatedAt: string | Date): Date {
  const ms =
    oldestCreatedAt instanceof Date
      ? oldestCreatedAt.getTime()
      : Date.parse(oldestCreatedAt);
  if (!Number.isFinite(ms)) {
    throw new Error("Saknar tidpunkt för bildgränsen");
  }
  return new Date(ms + HOUR_MS);
}

export function uploadRateLimitMessageSv(input: {
  retryAt: Date;
  timeZone?: string | null;
}): string {
  const timeZone = input.timeZone?.trim() || DEFAULT_TIMEZONE;
  const clock = formatZonedHm(input.retryAt, timeZone);
  const when = clock ? ` kl. ${clock}` : "";
  return `Du har nått gränsen på ${UPLOAD_HOURLY_IMAGE_LIMIT} bilder per timme. Du kan fota igen${when}.`;
}

export class UploadRateLimitError extends Error {
  readonly code = UPLOAD_RATE_LIMIT_CODE;
  readonly retryAt: Date;
  readonly timeZone: string;

  constructor(input: { retryAt: Date; timeZone?: string | null }) {
    const timeZone = input.timeZone?.trim() || DEFAULT_TIMEZONE;
    super(uploadRateLimitMessageSv({ retryAt: input.retryAt, timeZone }));
    this.name = "UploadRateLimitError";
    this.retryAt = input.retryAt;
    this.timeZone = timeZone;
  }
}

export type HourlyUploadRow = {
  createdAt: string;
  rawMetadata?: Record<string, unknown> | null;
};

/**
 * OCR failures stay on the import (raw_metadata) but do not spend the 20/h cap.
 * Rows without the flag still count, so older uploads in the window keep the limit.
 */
export function countsTowardHourlyUploadLimit(
  rawMetadata: Record<string, unknown> | null | undefined,
): boolean {
  if (!rawMetadata) return true;
  return rawMetadata.countsTowardUploadLimit !== false;
}

export function hourlyUploadsThatCount(rows: HourlyUploadRow[]): HourlyUploadRow[] {
  return rows.filter((row) => countsTowardHourlyUploadLimit(row.rawMetadata));
}

/** Successful reads and saved images count. Unknown, empty, and failed model calls do not. */
export function uploadLimitFlags(input: {
  provider: string;
  amountMinors: Array<number | null | undefined>;
  alreadyKnown: boolean;
  detectedKind?: string | null;
  groundingRejected?: boolean;
}): { ocrFailed: boolean; countsTowardUploadLimit: boolean } {
  if (input.provider === "none") {
    return { ocrFailed: false, countsTowardUploadLimit: true };
  }
  if (input.groundingRejected) {
    return { ocrFailed: true, countsTowardUploadLimit: false };
  }
  if (input.alreadyKnown) {
    return { ocrFailed: false, countsTowardUploadLimit: true };
  }
  const kind = input.detectedKind?.trim() || "unknown";
  const hasAmount = input.amountMinors.some(
    (amount) => typeof amount === "number" && Number.isFinite(amount) && amount > 0,
  );
  const counts = kind !== "unknown" && hasAmount;
  return { ocrFailed: !counts, countsTowardUploadLimit: counts };
}

export function isUploadRateLimitError(
  error: unknown,
): error is UploadRateLimitError {
  if (error instanceof UploadRateLimitError) return true;
  if (typeof error !== "object" || error === null) return false;
  const row = error as {
    code?: unknown;
    retryAt?: unknown;
    timeZone?: unknown;
  };
  return (
    row.code === UPLOAD_RATE_LIMIT_CODE &&
    row.retryAt instanceof Date &&
    (row.timeZone == null || typeof row.timeZone === "string")
  );
}
