import {
  defaultBankParserRegistry,
  selectImportableBankEvent,
  type BankEventCandidate,
  type ParsedBankMessage,
  type SelectImportableResult,
} from "./bank-parsers";
import type { ExtractionProviderResult } from "./extraction";
import { resolveReceiptPaidAmountMinor } from "./receipt-total";

export type ResolvedScreenshotImport =
  | {
      kind: "bank_sms";
      selection: SelectImportableResult;
      selected: BankEventCandidate | null;
      /** Unknown events to import, newest first. */
      selectedBatch: BankEventCandidate[];
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
      selectedBatch: [];
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

function looksLikeBankSmsText(text: string, detectedKind: string | null): boolean {
  const t = text.toLowerCase();
  return (
    detectedKind === "bangkok_bank_sms" ||
    /available balance is\s+(?:bt|thb?)/.test(t) ||
    /bal(?:ance)?\s+available\s+is\s+(?:bt|thb?)/.test(t) ||
    t.includes("withdrawal/transfer/payment") ||
    t.includes("withdrawal from your account") ||
    t.includes("withdrawal from account") ||
    t.includes("promptpay transfer") ||
    t.includes("moneyplus transfer") ||
    t.includes("deposit/transfer/payment") ||
    /amount\s+(?:bt|thb?)/.test(t) ||
    (t.includes("from your account") && /(?:bt|thb?)\s*[\d,]/.test(t)) ||
    (t.includes("to your account") && /(?:bt|thb?)\s*[\d,]/.test(t)) ||
    (t.includes("from account") && /(?:bt|thb?)\s*[\d,]/.test(t))
  );
}

function structuredMessagesToText(
  messages: unknown,
): { text: string; count: number } {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { text: "", count: 0 };
  }
  const lines: string[] = [];
  for (const m of messages) {
    if (!m || typeof m !== "object") continue;
    const row = m as Record<string, unknown>;
    const raw =
      typeof row.rawText === "string" && row.rawText.trim()
        ? row.rawText.trim()
        : null;
    if (raw) {
      lines.push(raw);
      continue;
    }
    if (row.amountMajor == null || row.balanceAfterMajor == null) continue;
    if (typeof row.accountHint !== "string" || !row.accountHint.trim()) continue;
    if (row.direction !== "credit" && row.direction !== "debit") continue;

    const amountStr = String(row.amountMajor).replace(/,/g, "");
    const balanceStr = String(row.balanceAfterMajor).replace(/,/g, "");
    const account = row.accountHint.trim();
    if (row.direction === "credit") {
      lines.push(
        `PromptPay transfer to your account ${account} of Bt ${amountStr} via MOBILE; the available balance is Bt ${balanceStr}.`,
      );
    } else {
      lines.push(
        `Withdrawal/transfer/payment from your account ${account} of Bt ${amountStr} via MOBILE; the available balance is Bt ${balanceStr}.`,
      );
    }
  }
  return { text: lines.join("\n\n"), count: lines.length };
}

function dedupeParsedMessages(
  messages: ParsedBankMessage[],
): ParsedBankMessage[] {
  const seen = new Set<string>();
  const out: ParsedBankMessage[] = [];
  for (const m of messages) {
    const key = [
      m.direction,
      m.amountMinor,
      m.balanceAfterMinor,
      m.maskedAccount,
      m.channel,
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

/**
 * SCREENSHOT → observations → normalize → propose all unknown bank events.
 * Never writes the ledger — only proposes candidates.
 */
export function resolveScreenshotImport(
  extraction: ExtractionProviderResult,
  existingFingerprints: Iterable<string>,
  options?: { preferBankSms?: boolean },
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
  const structured = structuredMessagesToText(meta.messages);
  if (structured.text) textParts.push(structured.text);

  for (const c of extraction.candidates) {
    const raw = c.rawPayload;
    if (raw && typeof raw.rawText === "string") textParts.push(raw.rawText);
    if (raw && typeof raw.fullText === "string") textParts.push(raw.fullText);
  }

  // Fallback: rebuild SMS text from structured candidate fields when OCR
  // returned amounts/balances but no raw transcription.
  if (!textParts.some((t) => looksLikeBankSmsText(t, detectedKind))) {
    const fromCandidates = structuredMessagesToText(
      extraction.candidates.map((c, i) => ({
        rawText:
          typeof c.rawPayload?.rawText === "string"
            ? c.rawPayload.rawText
            : null,
        amountMajor:
          c.amountMinor != null ? c.amountMinor / 100 : null,
        balanceAfterMajor:
          c.balanceAfterMinor != null ? c.balanceAfterMinor / 100 : null,
        accountHint:
          typeof c.rawPayload?.accountHint === "string" &&
          c.rawPayload.accountHint.trim()
            ? c.rawPayload.accountHint
            : "X0000",
        direction: c.direction,
        visualOrder: i,
      })),
    );
    if (fromCandidates.text) textParts.push(fromCandidates.text);
  }

  const combinedText = textParts.join("\n\n");
  const treatAsBank =
    options?.preferBankSms === true ||
    looksLikeBankSmsText(combinedText, detectedKind) ||
    detectedKind === "bangkok_bank_sms" ||
    structured.count > 0;

  if (treatAsBank && combinedText.trim()) {
    const parsed = dedupeParsedMessages(
      defaultBankParserRegistry.parse({
        institution: "Bangkok Bank",
        text: combinedText,
      }),
    );
    const selection = selectImportableBankEvent(parsed, existingFingerprints);

    if (selection.status === "ready") {
      const s = selection.selected;
      return {
        kind: "bank_sms",
        selection,
        selected: s,
        selectedBatch: selection.selectedBatch,
        suggestedAmountMinor: s.amountMinor,
        suggestedDescription: s.labelSv,
        // Only tip-in-batch may rewrite Hem saldo; older re-imports keep null.
        balanceAfterMinor: selection.updatesBalance
          ? selection.tipBalanceAfterMinor
          : null,
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
        selectedBatch: [],
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
      selectedBatch: [],
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
  const metaFullText =
    typeof extraction.rawMetadata?.fullText === "string"
      ? extraction.rawMetadata.fullText
      : combinedText;
  const suggestedAmountMinor = resolveReceiptPaidAmountMinor({
    visionAmountMinor: first?.amountMinor ?? null,
    fullText: metaFullText,
  });

  return {
    kind: "receipt_or_other",
    selectedBatch: [],
    suggestedAmountMinor,
    suggestedDescription: first?.description ?? null,
    balanceAfterMinor: first?.balanceAfterMinor ?? null,
    fingerprint: null,
    direction: first?.direction ?? "debit",
    currency,
    observationKind: "receipt",
    source: "receipt_camera",
    messageSv: suggestedAmountMinor
      ? "Vi läste totalsumman (det du faktiskt betalade) — dubbelkolla innan du sparar."
      : "Kunde inte läsa beloppet säkert. Fyll i själv eller ta en skarpare bild av totalsumman.",
    alreadyKnown: false,
  };
}
