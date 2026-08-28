/** Per-user cap before OpenAI vision runs. Shared PWA, two people, years of Fota. */
export const OCR_MAX_PER_HOUR = 20;
export const OCR_WINDOW_MS = 60 * 60 * 1000;
export const OCR_EXTRACT_TIMEOUT_MS = 45_000;

export const OCR_RATE_LIMIT_SV =
  "För många foton just nu. Vänta en stund och prova igen.";

export const OCR_RATE_CHECK_FAILED_SV =
  "Kunde inte kontrollera fototaket. Försök igen.";

export const OCR_EXTRACT_TIMEOUT_SV =
  "Det tog för lång tid att läsa bilden. Försök igen.";

export function ocrWindowStartIso(now = Date.now()): string {
  return new Date(now - OCR_WINDOW_MS).toISOString();
}

export function isOcrOverLimit(
  count: number,
  max = OCR_MAX_PER_HOUR,
): boolean {
  return count >= max;
}
