import type {
  ExtractedTransactionCandidate,
  SourceObservation,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import {
  modeForObservation,
  type CaptureImportKind,
} from "./capture-resume";

export type CapturePreviewEvent = {
  candidateId: string;
  direction: "debit" | "credit";
  amountMinor: number;
  labelSv: string;
};

export type CapturePreview = {
  observationId: string;
  candidateId: string | null;
  amount: string;
  description: string;
  currency: CurrencyCode;
  ocrStatus: "ok" | "unavailable" | "failed" | "all_known";
  confidence: number | null;
  message: string | null;
  previewUrl: string;
  importKind: CaptureImportKind | "unknown";
  balanceAfterMinor: number | null;
  fingerprint: string | null;
  alreadyKnown: boolean;
  skippedOlderCount: number;
  amountFromScan: boolean;
  direction: "debit" | "credit" | null;
  events: CapturePreviewEvent[];
};

function minorToInput(minor: number): string {
  return (minor / 100).toFixed(2).replace(".", ",");
}

function batchIndex(candidate: ExtractedTransactionCandidate): number {
  return typeof candidate.rawPayload?.batchIndex === "number"
    ? candidate.rawPayload.batchIndex
    : 0;
}

function usableRow(candidate: ExtractedTransactionCandidate): boolean {
  return (
    candidate.amountMinor != null &&
    candidate.amountMinor > 0 &&
    (candidate.direction === "debit" || candidate.direction === "credit") &&
    Boolean(candidate.fingerprint)
  );
}

function hasPositiveAmount(
  candidate: ExtractedTransactionCandidate,
): boolean {
  return candidate.amountMinor != null && candidate.amountMinor > 0;
}

/** Receipt notes often mention the scanned total when fingerprint is missing. */
export function parseNotesAmountMinor(notes: string | null): number | null {
  if (!notes) return null;
  const match = notes.match(
    /(\d{1,3}(?:[ \u00a0]\d{3})*|\d+)(?:[,.](\d{1,2}))?/,
  );
  if (!match) return null;
  const major = Number(match[1].replace(/[\s\u00a0]/g, ""));
  if (!Number.isFinite(major) || major <= 0) return null;
  const frac = (match[2] ?? "00").padEnd(2, "0").slice(0, 2);
  return major * 100 + Number(frac);
}

function toEvent(candidate: ExtractedTransactionCandidate): CapturePreviewEvent {
  return {
    candidateId: candidate.id,
    direction: candidate.direction as "debit" | "credit",
    amountMinor: candidate.amountMinor!,
    labelSv:
      typeof candidate.rawPayload?.labelSv === "string"
        ? candidate.rawPayload.labelSv
        : (candidate.description ?? ""),
  };
}

/** Map a stored observation + candidates back to the capture confirm DTO. */
export function buildCapturePreview(input: {
  observation: Pick<
    SourceObservation,
    "id" | "kind" | "institutionHint" | "status" | "notes"
  >;
  candidates: ExtractedTransactionCandidate[];
  previewUrl: string | null;
  fallbackCurrency: CurrencyCode;
}): CapturePreview | null {
  if (!input.previewUrl) return null;

  const importKind = modeForObservation(input.observation);
  const pending = input.candidates
    .filter((c) => c.status === "needs_review" && usableRow(c))
    .sort((a, b) => batchIndex(a) - batchIndex(b));
  const confirmed = input.candidates.filter(
    (c) => c.status === "confirmed" && usableRow(c),
  );
  const alreadyKnown =
    input.observation.status === "processed" ||
    (pending.length === 0 && confirmed.length > 0);

  const first = pending[0] ?? confirmed[0] ?? null;
  const looseAmount = input.candidates.find(hasPositiveAmount)?.amountMinor ?? null;
  const notesAmount =
    importKind === "receipt" ? parseNotesAmountMinor(input.observation.notes) : null;
  const amountMinor = first?.amountMinor ?? looseAmount ?? notesAmount;
  const amountFromScan = amountMinor != null;
  const ocrStatus: CapturePreview["ocrStatus"] = alreadyKnown
    ? "all_known"
    : pending.length > 0 || (importKind === "receipt" && amountFromScan)
      ? "ok"
      : "failed";

  const withBalance = [...pending, ...confirmed].find(
    (c) => c.balanceAfterMinor != null,
  );

  return {
    observationId: input.observation.id,
    candidateId: first?.id ?? null,
    amount: amountMinor != null ? minorToInput(amountMinor) : "",
    description: first?.description ?? "",
    currency: first?.currency ?? input.fallbackCurrency,
    ocrStatus,
    confidence: first?.confidence ?? null,
    message: input.observation.notes,
    previewUrl: input.previewUrl,
    importKind,
    balanceAfterMinor: withBalance?.balanceAfterMinor ?? null,
    fingerprint: first?.fingerprint ?? null,
    alreadyKnown,
    skippedOlderCount: 0,
    amountFromScan,
    direction:
      first?.direction === "credit" || first?.direction === "debit"
        ? first.direction
        : null,
    events: alreadyKnown ? [] : pending.map(toEvent),
  };
}
