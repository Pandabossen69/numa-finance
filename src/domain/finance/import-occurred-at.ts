/**
 * Resolve occurredAt when confirming a bank-SMS / bank-app batch row.
 *
 * - Prefer candidate OCR/parsed timestamp when present.
 * - Live tip import (tipInBatch): synthetic times just before confirm clock.
 * - Older SMS re-import without tip update: park on the previous calendar
 *   day so Spenderat idag is not inflated by historical bubbles.
 */
export function resolveSmsBatchOccurredAt(input: {
  candidateOccurredAt?: string | null;
  index: number;
  batchLength: number;
  baseMs: number;
  tipInBatch: boolean;
}): string {
  if (input.candidateOccurredAt) {
    const t = Date.parse(input.candidateOccurredAt);
    if (Number.isFinite(t)) return new Date(t).toISOString();
  }
  const offsetMs = Math.max(1, input.batchLength - input.index) * 3_000;
  if (!input.tipInBatch) {
    return new Date(input.baseMs - 24 * 60 * 60 * 1000 - offsetMs).toISOString();
  }
  return new Date(input.baseMs - offsetMs).toISOString();
}
