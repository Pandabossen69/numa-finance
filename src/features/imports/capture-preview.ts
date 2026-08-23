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
  const amountMinor = first?.amountMinor ?? null;
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
