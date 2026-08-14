import { isCurrencyCode, type CurrencyCode } from "@/domain/money";
import {
  defaultBankParserRegistry,
  selectImportableBankEvent,
  type BankEventCandidate,
  type ParsedBankMessage,
  type SelectImportableResult,
} from "./bank-parsers";
import {
  looksLikeBankAppScreenshot,
  parseBankAppVisionRows,
  parseBunqDetailFromText,
  selectImportableBankAppEvents,
  type BankAppEventCandidate,
  type SelectBankAppImportResult,
} from "./bank-app-parsers";
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
      currency: CurrencyCode;
      observationKind: "screenshot";
      source: "screenshot";
      messageSv: string;
      alreadyKnown: boolean;
    }
  | {
      kind: "bank_app";
      selection: SelectBankAppImportResult;
      selected: BankAppEventCandidate | null;
      selectedBatch: BankAppEventCandidate[];
      suggestedAmountMinor: number | null;
      suggestedDescription: string | null;
      balanceAfterMinor: null;
      fingerprint: string | null;
      direction: "debit" | "credit" | null;
      currency: CurrencyCode;
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
      currency: CurrencyCode;
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

function collectTextParts(extraction: ExtractionProviderResult): string {
  const meta = extraction.rawMetadata ?? {};
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
  return textParts.join("\n\n");
}

function resolveBankAppImport(
  extraction: ExtractionProviderResult,
  existingFingerprints: Iterable<string>,
  combinedText: string,
): ResolvedScreenshotImport | null {
  const meta = extraction.rawMetadata ?? {};
  const detectedKind =
    typeof meta.detectedKind === "string" ? meta.detectedKind : null;

  if (
    !looksLikeBankAppScreenshot(combinedText, detectedKind) &&
    detectedKind !== "bank_app" &&
    detectedKind !== "bank_app_detail" &&
    detectedKind !== "bank_app_list"
  ) {
    return null;
  }

  const institutionHint =
    typeof meta.institutionHint === "string" ? meta.institutionHint : null;

  const visionRows = Array.isArray(meta.transactions)
    ? (meta.transactions as Parameters<typeof parseBankAppVisionRows>[0])
    : extraction.candidates.map((c) => ({
        merchant:
          typeof c.rawPayload?.merchant === "string"
            ? c.rawPayload.merchant
            : c.description,
        direction: c.direction,
        amountMajor:
          c.amountMinor != null ? c.amountMinor / 100 : null,
        currency: c.currency,
        originalAmountMajor:
          typeof c.rawPayload?.originalAmountMajor === "number" ||
          typeof c.rawPayload?.originalAmountMajor === "string"
            ? c.rawPayload.originalAmountMajor
            : null,
        originalCurrency:
          typeof c.rawPayload?.originalCurrency === "string"
            ? c.rawPayload.originalCurrency
            : null,
        occurredAt:
          c.occurredAt ??
          (typeof c.rawPayload?.occurredAt === "string"
            ? c.rawPayload.occurredAt
            : null),
        categoryHint:
          typeof c.rawPayload?.categoryHint === "string"
            ? c.rawPayload.categoryHint
            : null,
        failed:
          c.rawPayload?.failed === true ||
          c.rawPayload?.strikethrough === true,
        strikethrough: c.rawPayload?.strikethrough === true,
        statusText:
          typeof c.rawPayload?.statusText === "string"
            ? c.rawPayload.statusText
            : null,
        rawText:
          typeof c.rawPayload?.rawText === "string"
            ? c.rawPayload.rawText
            : null,
      }));

  let parsed = parseBankAppVisionRows(visionRows, {
    institutionHint,
    fullText: combinedText,
  });

  if (parsed.length === 0 && combinedText.trim()) {
    parsed = parseBunqDetailFromText(combinedText);
  }

  const selection = selectImportableBankAppEvents(
    parsed,
    existingFingerprints,
  );

  if (selection.status === "ready") {
    const s = selection.selectedBatch[0]!;
    return {
      kind: "bank_app",
      selection,
      selected: s,
      selectedBatch: selection.selectedBatch,
      suggestedAmountMinor: s.amountMinor,
      suggestedDescription: s.labelSv,
      balanceAfterMinor: null,
      fingerprint: s.fingerprint.fingerprint,
      direction: s.direction,
      currency: s.currency,
      observationKind: "screenshot",
      source: "screenshot",
      messageSv: selection.messageSv,
      alreadyKnown: false,
    };
  }

  if (selection.status === "all_known") {
    return {
      kind: "bank_app",
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

  // Fall through to receipt only when we are not sure this is a bank app.
  if (
    detectedKind === "bank_app" ||
    detectedKind === "bank_app_detail" ||
    detectedKind === "bank_app_list" ||
    looksLikeBankAppScreenshot(combinedText, detectedKind)
  ) {
    return {
      kind: "bank_app",
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

  return null;
}

/**
 * SCREENSHOT → observations → normalize → propose all unknown bank events.
 * Never writes the ledger — only proposes candidates.
 *
 * Duplicate checks must use **confirmed** fingerprints only. Pending
 * needs_review candidates from abandoned uploads must not block a re-scan
 * (that bug showed “finns redan” when nothing was saved).
 */
export function resolveScreenshotImport(
  extraction: ExtractionProviderResult,
  existingFingerprints: Iterable<string>,
  options?: { preferBankSms?: boolean; preferBankApp?: boolean },
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

  const combinedText = textParts.join("\n\n") || collectTextParts(extraction);
  const treatAsBankSms =
    options?.preferBankSms === true ||
    looksLikeBankSmsText(combinedText, detectedKind) ||
    detectedKind === "bangkok_bank_sms" ||
    structured.count > 0;

  if (treatAsBankSms && combinedText.trim()) {
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

    // Prefer bank SMS when forced; otherwise try bank-app / receipt fallback.
    if (options?.preferBankSms) {
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
  }

  if (!options?.preferBankSms || options?.preferBankApp) {
    const bankApp = resolveBankAppImport(
      extraction,
      existingFingerprints,
      combinedText,
    );
    if (bankApp) return bankApp;
  }

  const first = extraction.candidates[0];
  const currency: CurrencyCode =
    first?.currency && isCurrencyCode(first.currency)
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
  const hasAmount =
    suggestedAmountMinor != null && suggestedAmountMinor > 0;
  const confidence =
    typeof first?.confidence === "number" ? first.confidence : null;
  const unclear = extraction.rawMetadata?.unclear === true;
  const quality = !hasAmount
    ? "Kunde inte läsa beloppet säkert. Fyll i själv eller ta en skarpare bild av totalsumman."
    : unclear || (confidence != null && confidence < 0.55)
      ? "Bilden är otydlig — kontrollera att beloppet är exakt samma som på kvittot innan du sparar."
      : confidence != null && confidence < 0.75
        ? "Osäker läsning — dubbelkolla beloppet noga innan du sparar."
        : "Vi läste totalsumman (det du faktiskt betalade) — dubbelkolla innan du sparar.";

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
    messageSv: quality,
    alreadyKnown: false,
  };
}
