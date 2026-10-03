import { cleanBankAppMerchant } from "./bank-app-amounts";
import type { ExtractionProviderResult } from "./extraction";

/** Shown when the image cannot be grounded. Includes the path to Manuellt. */
export const COULD_NOT_READ_SV =
  "Kunde inte läsa bilden. Skriv beloppet under Manuellt.";

const MIN_TEXT_LENGTH = 8;
const YEAR_MS = 366 * 24 * 60 * 60 * 1000;

export type GroundingReason =
  | "fulltext_empty"
  | "fulltext_too_short"
  | "fulltext_no_digits"
  | "fulltext_no_amount"
  | "candidates_not_in_text";

type Candidate = ExtractionProviderResult["candidates"][number];

type VisionRow = {
  index: number;
  candidate: Candidate | null;
  transaction: Record<string, unknown> | null;
};

/**
 * Keep a vision read only when the amount and the store name are actually in
 * the transcribed text. Empty, short, or amount-free transcripts are rejected.
 * Dates more than about a year from `now` stay on the row, but move to today.
 */
export function groundVisionExtraction(
  extraction: ExtractionProviderResult,
  now: Date = new Date(),
): ExtractionProviderResult {
  const meta = extraction.rawMetadata ?? {};
  const modelFullText = transcriptOf(meta);
  const trimmed = modelFullText.trim();
  const unusable = unusableTranscript(trimmed);
  if (unusable) return rejectAll(extraction, unusable, modelFullText);

  const rows = visionRows(extraction);
  if (rows.length === 0) return extraction;

  const requireStore = !isSmsRead(meta, rows);
  const kept: VisionRow[] = [];
  const dropped: Array<{ merchant: string | null; amountMinor: number | null }> = [];
  let dateUncertain = false;

  for (const row of rows) {
    const amountMinor = rowAmount(row);
    const labels = storeLabels(row);
    const amountOk =
      amountMinor != null && amountAppearsInText(amountMinor, trimmed);
    const storeOk = !requireStore || labels.some((label) => labelAppears(label, trimmed));
    if (!amountOk || !storeOk) {
      dropped.push({
        merchant: labels[0] ?? merchantHint(row),
        amountMinor,
      });
      continue;
    }
    const stamped = stampFarDate(row, now);
    if (stamped.uncertain) dateUncertain = true;
    kept.push(stamped.row);
  }

  if (kept.length === 0) {
    return rejectAll(extraction, "candidates_not_in_text", modelFullText, dropped);
  }

  if (kept.length === rows.length && !dateUncertain) return extraction;

  const candidates = kept
    .map((row) => row.candidate)
    .filter((candidate): candidate is Candidate => candidate != null);
  const transactions = kept
    .map((row) => row.transaction)
    .filter((transaction): transaction is Record<string, unknown> => transaction != null);
  const sourceTransactions = Array.isArray(meta.transactions) ? meta.transactions : null;
  const filterSmsMessages =
    Array.isArray(meta.messages) && (sourceTransactions == null || sourceTransactions.length === 0);

  return {
    ...extraction,
    candidates: extraction.candidates.length > 0 ? candidates : extraction.candidates,
    rawMetadata: {
      ...meta,
      ...(sourceTransactions ? { transactions } : {}),
      ...(filterSmsMessages ? { messages: filterMessages(meta, kept) } : {}),
      ...(dateUncertain ? { dateUncertain: true } : {}),
      ...(dropped.length > 0 ? { groundingDropped: dropped } : {}),
    },
  };
}

function transcriptOf(meta: Record<string, unknown>): string {
  if (typeof meta.modelFullText === "string") return meta.modelFullText;
  return typeof meta.fullText === "string" ? meta.fullText : "";
}

function unusableTranscript(trimmed: string): GroundingReason | null {
  if (!trimmed) return "fulltext_empty";
  if (trimmed.length < MIN_TEXT_LENGTH) return "fulltext_too_short";
  if (!/\d/.test(trimmed)) return "fulltext_no_digits";
  if (!textHasAmount(trimmed)) return "fulltext_no_amount";
  return null;
}

function isSmsRead(meta: Record<string, unknown>, rows: VisionRow[]): boolean {
  if (meta.detectedKind === "bangkok_bank_sms") return true;
  const transactions = Array.isArray(meta.transactions) ? meta.transactions : [];
  return transactions.length === 0 && rows.some((row) => row.candidate?.balanceAfterMinor != null);
}

function visionRows(extraction: ExtractionProviderResult): VisionRow[] {
  const meta = extraction.rawMetadata ?? {};
  const transactions = Array.isArray(meta.transactions)
    ? meta.transactions.filter(
        (row): row is Record<string, unknown> =>
          row != null && typeof row === "object" && !Array.isArray(row),
      )
    : [];
  if (transactions.length > 0) {
    return transactions.map((transaction, index) => ({
      index,
      transaction,
      candidate: extraction.candidates[index] ?? null,
    }));
  }
  return extraction.candidates.map((candidate, index) => ({
    index,
    candidate,
    transaction: null,
  }));
}

function rowAmount(row: VisionRow): number | null {
  const fromCandidate = row.candidate?.amountMinor;
  if (typeof fromCandidate === "number" && fromCandidate > 0) return fromCandidate;
  const tx = row.transaction;
  if (!tx) return null;
  return majorToMinor(tx.amountMajor) ?? majorToMinor(tx.originalAmountMajor);
}

function majorToMinor(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value * 100);
  }
  if (typeof value === "string" && value.trim()) {
    const minors = amountMinorsInText(value);
    return minors[0] ?? null;
  }
  return null;
}

function merchantHint(row: VisionRow): string | null {
  const tx = row.transaction;
  if (typeof tx?.merchant === "string" && tx.merchant.trim()) return tx.merchant.trim();
  const description = row.candidate?.description;
  return typeof description === "string" && description.trim() ? description.trim() : null;
}

function labelsFrom(bits: unknown[]): string[] {
  const labels: string[] = [];
  for (const bit of bits) {
    if (typeof bit !== "string") continue;
    for (const part of bit.split(/[·•|]/)) {
      const cleaned = cleanBankAppMerchant(part);
      if (cleaned && cleaned.length >= 2) labels.push(cleaned);
    }
  }
  return labels;
}

function storeLabels(row: VisionRow): string[] {
  const named = labelsFrom([
    row.transaction?.merchant,
    row.candidate?.rawPayload?.merchant,
    row.candidate?.description,
  ]);
  if (named.length > 0) return named;
  return labelsFrom([row.transaction?.rawText, row.candidate?.rawPayload?.rawText]);
}

function stampFarDate(
  row: VisionRow,
  now: Date,
): { row: VisionRow; uncertain: boolean } {
  const current =
    (typeof row.transaction?.occurredAt === "string" && row.transaction.occurredAt) ||
    row.candidate?.occurredAt ||
    null;
  if (!dateIsFar(current, now)) return { row, uncertain: false };
  const occurredAt = now.toISOString();
  const transaction = row.transaction
    ? { ...row.transaction, occurredAt, dateUncertain: true }
    : null;
  const candidate = row.candidate
    ? {
        ...row.candidate,
        occurredAt,
        rawPayload: {
          ...row.candidate.rawPayload,
          occurredAt,
          dateUncertain: true,
        },
      }
    : null;
  return { row: { ...row, transaction, candidate }, uncertain: true };
}

function dateIsFar(value: string | null, now: Date): boolean {
  if (!value?.trim()) return false;
  const direct = Date.parse(value);
  const ms = Number.isFinite(direct)
    ? direct
    : Date.parse(`${value.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? ""}T12:00:00Z`);
  if (!Number.isFinite(ms)) return false;
  return Math.abs(ms - now.getTime()) > YEAR_MS;
}

function filterMessages(meta: Record<string, unknown>, kept: VisionRow[]): unknown[] {
  const messages = Array.isArray(meta.messages) ? meta.messages : [];
  const indexes = new Set(kept.map((row) => row.index));
  return messages.filter((_, index) => indexes.has(index));
}

function rejectAll(
  extraction: ExtractionProviderResult,
  reason: GroundingReason,
  modelFullText: string,
  dropped: Array<{ merchant: string | null; amountMinor: number | null }> = [],
): ExtractionProviderResult {
  return {
    provider: extraction.provider,
    candidates: [],
    rawMetadata: {
      ...extraction.rawMetadata,
      detectedKind: "unknown",
      fullText: "",
      modelFullText,
      transactions: [],
      messages: [],
      smsTexts: [],
      message: COULD_NOT_READ_SV,
      groundingRejected: true,
      groundingReason: reason,
      ...(dropped.length > 0 ? { groundingDropped: dropped } : {}),
    },
  };
}

const AMOUNT_TOKEN =
  /(?<![\d])(?:\d{1,3}(?:[ \u00a0]\d{3})+(?:[.,]\d{1,2})?|\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?![\d])/gu;

function prepareAmountText(text: string): string {
  return text
    .replace(/[฿€$]/g, " ")
    .replace(/บาท/g, " ")
    .replace(/(?:THB|SEK|EUR|USD|KRONOR|BAHT)(?!\p{L})/giu, " ")
    .replace(/\b(?:BT|KR)\b/giu, " ")
    .replace(/[−–—\u2212]/g, "-");
}

export function textHasAmount(text: string): boolean {
  const prepared = prepareAmountText(text);
  if (/\d[\d\s\u00a0]*[.,]\d{2}/u.test(prepared)) return true;
  return /(?:THB|SEK|EUR|USD|BAHT|฿|บาท|€|\$|\bBT\b|\bKR\b)/iu.test(text) && /\d/.test(text);
}

export function amountMinorsInText(text: string): number[] {
  const prepared = prepareAmountText(text);
  const minors: number[] = [];
  for (const match of prepared.matchAll(AMOUNT_TOKEN)) {
    const minor = tokenToMinor(match[0]);
    if (minor != null) minors.push(minor);
  }
  return minors;
}

export function amountAppearsInText(amountMinor: number, text: string): boolean {
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) return false;
  const target = Math.round(amountMinor);
  return amountMinorsInText(text).includes(target);
}

function tokenToMinor(token: string): number | null {
  const compact = token.replace(/[\s\u00a0]/g, "");
  const european = compact.match(/^(\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/);
  if (european) {
    return decimalMinor(european[1]!.replace(/\./g, ""), european[2]);
  }
  const us = compact.match(/^(\d{1,3}(?:,\d{3})+)(?:\.(\d{1,2}))?$/);
  if (us) return decimalMinor(us[1]!.replace(/,/g, ""), us[2]);
  const decimal = compact.match(/^(\d+)[.,](\d{1,2})$/);
  if (decimal) return decimalMinor(decimal[1]!, decimal[2]);
  if (/^\d+$/.test(compact)) return decimalMinor(compact);
  return null;
}

function decimalMinor(whole: string, fraction?: string): number | null {
  const major = Number(whole);
  if (!Number.isFinite(major)) return null;
  const frac = (fraction ?? "").padEnd(2, "0").slice(0, 2);
  return major * 100 + (frac ? Number(frac) : 0);
}

export function labelAppears(label: string, text: string): boolean {
  const needle = foldLabel(label);
  const hay = foldLabel(text);
  if (needle.length < 2) return false;
  let from = 0;
  while (from < hay.length) {
    const index = hay.indexOf(needle, from);
    if (index < 0) return false;
    const before = index === 0 ? "" : hay[index - 1]!;
    const after = index + needle.length >= hay.length ? "" : hay[index + needle.length]!;
    if (isBoundary(before) && isBoundary(after)) return true;
    from = index + needle.length;
  }
  return false;
}

function foldLabel(value: string): string {
  return value
    .normalize("NFC")
    .toLocaleLowerCase("sv")
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isBoundary(char: string): boolean {
  return char === "" || !/[\p{L}\p{N}]/u.test(char);
}
