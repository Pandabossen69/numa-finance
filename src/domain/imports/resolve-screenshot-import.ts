import {
  defaultBankParserRegistry,
  selectImportableBankEvent,
  type BankEventCandidate,
  type ParsedBankMessage,
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

function looksLikeBankSmsText(text: string, detectedKind: string | null): boolean {
  const t = text.toLowerCase();
  return (
    detectedKind === "bangkok_bank_sms" ||
    t.includes("available balance is bt") ||
    t.includes("withdrawal/transfer/payment") ||
    t.includes("withdrawal from your account") ||
    t.includes("promptpay transfer to") ||
    t.includes("deposit/transfer/payment") ||
    (t.includes("from your account") && t.includes("bt"))
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
    // Rebuild a parseable line from structured vision fields when OCR text is thin.
    const amount = row.amountMajor;
    const balance = row.balanceAfterMajor;
    const account =
      typeof row.accountHint === "string" ? row.accountHint : "X0000";
    const direction = row.direction === "credit" ? "credit" : "debit";
    if (amount == null && balance == null) continue;
    const amountStr =
      amount == null
        ? "0.00"
        : String(amount).includes(".")
          ? String(amount)
          : `${amount}.00`;
    const balanceStr =
      balance == null
        ? "0.00"
        : String(balance).includes(".")
          ? String(balance)
          : `${balance}.00`;
    if (direction === "credit") {
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
  const structured = structuredMessagesToText(meta.messages);
  if (structured.text) textParts.push(structured.text);

  for (const c of extraction.candidates) {
    const raw = c.rawPayload;
    if (raw && typeof raw.rawText === "string") textParts.push(raw.rawText);
    if (raw && typeof raw.fullText === "string") textParts.push(raw.fullText);
  }

  const combinedText = textParts.join("\n\n");
  const treatAsBank =
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
