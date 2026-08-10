import {
  defaultBankParserRegistry,
  selectImportableBankEvent,
  type BankEventCandidate,
  type SelectImportableResult,
} from "./bank-parsers";
import type { ExtractionProviderResult } from "./extraction";

export type ResolvedScreenshotImport =
  | {
      kind: "bank_sms";
      selection: SelectImportableResult;
      selected: BankEventCandidate | null;
      suggestedAmountMinor: number | null;
      suggestedDescription: string | null;
      balanceAfterMinor: number | null;
      fingerprint: string | null;
      direction: "debit" | "credit" | null;
      currency: "THB" | "SEK";
      observationKind: "screenshot";
      source: "screenshot";
      messageSv: string;
      alreadyKnown: boolean;
    }
  | {
      kind: "receipt_or_other";
      suggestedAmountMinor: number | null;
      suggestedDescription: string | null;
      balanceAfterMinor: number | null;
      fingerprint: string | null;
      direction: "debit" | "credit" | null;
      currency: "THB" | "SEK";
      observationKind: "receipt";
      source: "receipt_camera";
      messageSv: string;
      alreadyKnown: boolean;
    };

/**
 * SCREENSHOT → observations → normalize → pick latest unknown bank event.
 * Never writes the ledger — only proposes a candidate.
 */
export function resolveScreenshotImport(
  extraction: ExtractionProviderResult,
  existingFingerprints: Iterable<string>,
): ResolvedScreenshotImport {
  const meta = extraction.rawMetadata ?? {};
  const detectedKind =
    typeof meta.detectedKind === "string" ? meta.detectedKind : null;

  const textParts: string[] = [];
  if (typeof meta.fullText === "string" && meta.fullText.trim()) {
    textParts.push(meta.fullText);
  }
  if (Array.isArray(meta.smsTexts)) {
    for (const t of meta.smsTexts) {
      if (typeof t === "string" && t.trim()) textParts.push(t);
    }
  }
  for (const c of extraction.candidates) {
    const raw = c.rawPayload;
    if (raw && typeof raw.rawText === "string") textParts.push(raw.rawText);
    if (raw && typeof raw.fullText === "string") textParts.push(raw.fullText);
  }

  const combinedText = textParts.join("\n\n");
  const looksLikeBankSms =
    detectedKind === "bangkok_bank_sms" ||
    /available balance is bt/i.test(combinedText) ||
    /withdrawal\/transfer\/payment/i.test(combinedText);

  if (looksLikeBankSms && combinedText.trim()) {
    const parsed = defaultBankParserRegistry.parse({
      institution: "Bangkok Bank",
      text: combinedText,
    });
    const selection = selectImportableBankEvent(parsed, existingFingerprints);

    if (selection.status === "ready") {
      const s = selection.selected;
      return {
        kind: "bank_sms",
        selection,
        selected: s,
        suggestedAmountMinor: s.amountMinor,
        suggestedDescription: s.labelSv,
        balanceAfterMinor: s.balanceAfterMinor,
        fingerprint: s.fingerprint?.fingerprint ?? null,
        direction: s.direction,
        currency: s.currency ?? "THB",
        observationKind: "screenshot",
        source: "screenshot",
        messageSv: selection.messageSv,
        alreadyKnown: false,
      };
    }

    if (selection.status === "all_known") {
      return {
        kind: "bank_sms",
        selection,
        selected: null,
        suggestedAmountMinor: null,
        suggestedDescription: null,
        balanceAfterMinor: null,
        fingerprint: null,
        direction: null,
        currency: "THB",
        observationKind: "screenshot",
        source: "screenshot",
        messageSv: selection.messageSv,
        alreadyKnown: true,
      };
    }

    return {
      kind: "bank_sms",
      selection,
      selected: null,
      suggestedAmountMinor: null,
      suggestedDescription: null,
      balanceAfterMinor: null,
      fingerprint: null,
      direction: null,
      currency: "THB",
      observationKind: "screenshot",
      source: "screenshot",
      messageSv: selection.messageSv,
      alreadyKnown: false,
    };
  }

  const first = extraction.candidates[0];
  const currency =
    first?.currency === "SEK" || first?.currency === "THB"
      ? first.currency
      : "THB";

  return {
    kind: "receipt_or_other",
    suggestedAmountMinor: first?.amountMinor ?? null,
    suggestedDescription: first?.description ?? null,
    balanceAfterMinor: first?.balanceAfterMinor ?? null,
    fingerprint: null,
    direction: first?.direction ?? "debit",
    currency,
    observationKind: "receipt",
    source: "receipt_camera",
    messageSv: first?.amountMinor
      ? "Vi hittade ett belopp på kvittot — dubbelkolla innan du sparar."
      : "Kunde inte läsa beloppet säkert. Fyll i själv.",
    alreadyKnown: false,
  };
}
