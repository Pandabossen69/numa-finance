/** Categories the capture chip can actually select. */
export const CAPTURE_CATEGORIES = [
  "Mat",
  "Transport",
  "Shopping",
  "Boende",
  "Övrigt",
] as const;

/**
 * Trust an AI category only when it is one of the known labels.
 * Anything else (unknown words, empty, non-strings) is ignored.
 */
export function resolveCategoryFromHint(
  hint: string | null | undefined,
): string | null {
  if (typeof hint !== "string") return null;
  const normalized = hint.trim().toLowerCase();
  if (!normalized) return null;
  return CAPTURE_CATEGORIES.find((c) => c.toLowerCase() === normalized) ?? null;
}

/** First debit hint, or Mat when the hint is missing or not a known category. */
export function categoryFromEvents(
  events: Array<{ direction: string; categoryHint?: string | null }> | undefined,
): string {
  return (
    resolveCategoryFromHint(
      events?.find((event) => event.direction === "debit")?.categoryHint,
    ) ?? "Mat"
  );
}
