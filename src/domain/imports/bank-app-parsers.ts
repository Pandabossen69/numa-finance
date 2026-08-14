/**
 * Bank-app screenshot imports (bunq, Revolut, …) — not Bangkok Bank SMS.
 *
 * Rules:
 * 1. Never invent money; skip failed / expired / strikethrough rows.
 * 2. Post in the **card/account currency** (usually EUR); THB FX lines are annotation.
 * 3. Fingerprint = institution + merchant + direction + card amount + minute
 *    so detail + list shots of the same debit never double-import.
 */

import {
  buildBankAppFingerprint,
  matchFingerprint,
  type FingerprintResult,
} from "@/domain/finance/fingerprint";
import { formatMoney, money, type CurrencyCode } from "@/domain/money";
import { parseCurrencyToken } from "@/domain/money/currency";
import {
  europeanAmountToMinor,
  tryEuropeanAmountToMinor,
} from "@/domain/imports/ocr-amounts";
import { planBankAppLedger } from "@/domain/imports/bank-app-ledger";

export type BankAppInstitution = "bunq" | "revolut" | "unknown_bank_app";

export type ParsedBankAppTransaction = {
  institution: BankAppInstitution;
  merchant: string;
  direction: "debit" | "credit";
  /** Ledger amount in account currency (what left the card). */
  amountMinor: number;
  currency: CurrencyCode;
  displayAmountMinor: number | null;
  displayCurrency: string | null;
  originalAmountMinor: number | null;
  originalCurrency: string | null;
  annotationSv: string | null;
  occurredAt: string;
  categoryHint: string | null;
  failed: boolean;
  confidence: number;
  raw: string;
  sourceIndex: number;
};

export type BankAppEventCandidate = ParsedBankAppTransaction & {
  fingerprint: FingerprintResult;
  labelSv: string;
};

export type SelectBankAppImportResult =
  | {
      status: "ready";
      selectedBatch: BankAppEventCandidate[];
      all: BankAppEventCandidate[];
      skippedDuplicateCount: number;
      skippedFailedCount: number;
      messageSv: string;
    }
  | {
      status: "all_known";
      all: BankAppEventCandidate[];
      skippedDuplicateCount: number;
      skippedFailedCount: number;
      messageSv: string;
    }
  | {
      status: "none";
      all: BankAppEventCandidate[];
      skippedFailedCount: number;
      messageSv: string;
    };

const FAILED_RE =
  /\b(failed|expired|misslyckad|utg[aå]ngen|avbruten|cancelled|canceled|declined)\b/i;

const MONTHS_SV: Record<string, string> = {
  januari: "01",
  februari: "02",
  mars: "03",
  april: "04",
  maj: "05",
  juni: "06",
  juli: "07",
  augusti: "08",
  september: "09",
  oktober: "10",
  november: "11",
  december: "12",
};

export function detectBankAppInstitution(
  text: string,
  hint?: string | null,
): BankAppInstitution {
  const h = (hint ?? "").toLowerCase();
  const t = text.toLowerCase();
  if (h.includes("bunq") || t.includes("bunq") || t.includes("zerofx")) {
    return "bunq";
  }
  if (h.includes("revolut") || t.includes("revolut")) return "revolut";
  if (
    t.includes("onlinebetalning") ||
    t.includes("senaste transaktioner") ||
    t.includes("påfyllning av kort") ||
    t.includes("dela betalning") ||
    t.includes("begär betalning")
  ) {
    return "bunq";
  }
  return "unknown_bank_app";
}

export function looksLikeBankAppScreenshot(
  text: string,
  detectedKind?: string | null,
): boolean {
  if (
    detectedKind === "bank_app" ||
    detectedKind === "bank_app_detail" ||
    detectedKind === "bank_app_list"
  ) {
    return true;
  }
  const t = text.toLowerCase();
  if (t.includes("withdrawal") && /available balance is/.test(t)) {
    return false;
  }
  return (
    detectBankAppInstitution(t) !== "unknown_bank_app" ||
    /\b(onlinebetalning|senaste transaktioner|card top up|zerofx)\b/i.test(t) ||
    (/€|eur\b/.test(t) && /\b(grab|thb|bangkok)\b/i.test(t))
  );
}

/** Parse "23 juli 2026 16:46" or ISO-ish strings → YYYY-MM-DDTHH:mm */
export function parseBankAppOccurredAt(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const iso = s.match(
    /^(\d{4}-\d{2}-\d{2})[T\s](\d{2}):(\d{2})(?::\d{2})?/,
  );
  if (iso) return `${iso[1]}T${iso[2]}:${iso[3]}`;

  const sv = s.match(
    /(\d{1,2})\s+(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/i,
  );
  if (sv) {
    const day = sv[1]!.padStart(2, "0");
    const month = MONTHS_SV[sv[2]!.toLowerCase()];
    const year = sv[3]!;
    const hh = (sv[4] ?? "12").padStart(2, "0");
    const mm = (sv[5] ?? "00").padStart(2, "0");
    if (!month) return null;
    return `${year}-${month}-${day}T${hh}:${mm}`;
  }

  return null;
}

function pickLedgerAmount(input: {
  amountMinor: number | null;
  currency: string | null;
  originalAmountMinor: number | null;
  originalCurrency: string | null;
  institution: string;
  merchant: string;
  direction: "debit" | "credit";
  rawText?: string | null;
  fullText?: string | null;
  occurredAt?: string | null;
}): { amountMinor: number; currency: CurrencyCode; annotationSv: string | null } | null {
  const plan = planBankAppLedger({
    institution: input.institution,
    merchant: input.merchant,
    direction: input.direction,
    displayAmountMinor: input.amountMinor,
    displayCurrency: input.currency,
    originalAmountMinor: input.originalAmountMinor,
    originalCurrency: input.originalCurrency,
    rawText: input.rawText,
    fullText: input.fullText,
    occurredAt: input.occurredAt,
    preferFxToPrimary: false,
  });
  if (plan.mode === "unsupported") return null;
  return {
    amountMinor: plan.amountMinor,
    currency: plan.currency,
    annotationSv: plan.annotationSv,
  };
}

export type BankAppVisionRow = {
  merchant?: string | null;
  direction?: "debit" | "credit" | null;
  amountMajor?: number | string | null;
  currency?: string | null;
  originalAmountMajor?: number | string | null;
  originalCurrency?: string | null;
  occurredAt?: string | null;
  categoryHint?: string | null;
  failed?: boolean | null;
  strikethrough?: boolean | null;
  statusText?: string | null;
  rawText?: string | null;
};

function majorFieldToMinor(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const raw = typeof value === "number" ? String(value) : String(value);
  // Vision often returns JS numbers (6.6) for European "6,60".
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.round(value * 100);
  }
  return tryEuropeanAmountToMinor(raw);
}

export function parseBankAppVisionRows(
  rows: BankAppVisionRow[],
  options?: { institutionHint?: string | null; fullText?: string | null },
): ParsedBankAppTransaction[] {
  const institution = detectBankAppInstitution(
    options?.fullText ?? "",
    options?.institutionHint,
  );
  const out: ParsedBankAppTransaction[] = [];

  rows.forEach((row, sourceIndex) => {
    const statusBlob = [row.statusText, row.rawText, row.merchant]
      .filter(Boolean)
      .join(" ");
    const failed =
      row.failed === true ||
      row.strikethrough === true ||
      FAILED_RE.test(statusBlob);

    const merchant = (row.merchant ?? "").trim() || "Okänd";
    const direction =
      row.direction === "credit" || row.direction === "debit"
        ? row.direction
        : "debit";

    const displayAmountMinor = majorFieldToMinor(row.amountMajor);
    const displayCurrency = parseCurrencyToken(row.currency) ??
      (row.currency ? String(row.currency).toUpperCase() : null);
    const originalAmountMinor = majorFieldToMinor(row.originalAmountMajor);
    const originalCurrency = parseCurrencyToken(row.originalCurrency) ??
      (row.originalCurrency ? String(row.originalCurrency).toUpperCase() : null);

    const occurredAt = parseBankAppOccurredAt(row.occurredAt);
    if (!occurredAt) return;

    const ledger = pickLedgerAmount({
      amountMinor: displayAmountMinor,
      currency: displayCurrency,
      originalAmountMinor,
      originalCurrency,
      institution,
      merchant,
      direction,
      rawText: row.rawText,
      fullText: options?.fullText,
      occurredAt,
    });

    // Failed / strikethrough: keep a stub so select can report skippedFailedCount.
    if (failed) {
      out.push({
        institution,
        merchant,
        direction,
        amountMinor: ledger?.amountMinor ?? displayAmountMinor ?? 1,
        currency: ledger?.currency ?? parseCurrencyToken(displayCurrency) ?? "EUR",
        displayAmountMinor,
        displayCurrency:
          typeof displayCurrency === "string" ? displayCurrency : null,
        originalAmountMinor,
        originalCurrency:
          typeof originalCurrency === "string" ? originalCurrency : null,
        annotationSv: ledger?.annotationSv ?? null,
        occurredAt,
        categoryHint: row.categoryHint?.trim() || null,
        failed: true,
        confidence: 0.7,
        raw: row.rawText?.trim() || statusBlob,
        sourceIndex,
      });
      return;
    }

    if (!ledger) return;

    out.push({
      institution,
      merchant,
      direction,
      amountMinor: ledger.amountMinor,
      currency: ledger.currency,
      displayAmountMinor,
      displayCurrency:
        typeof displayCurrency === "string" ? displayCurrency : null,
      originalAmountMinor,
      originalCurrency:
        typeof originalCurrency === "string" ? originalCurrency : null,
      annotationSv: ledger.annotationSv,
      occurredAt,
      categoryHint: row.categoryHint?.trim() || null,
      failed: false,
      confidence: displayAmountMinor != null ? 0.92 : 0.8,
      raw: row.rawText?.trim() || statusBlob,
      sourceIndex,
    });
  });

  return out;
}

/**
 * Heuristic parse from OCR fullText for a single bunq-style detail screen.
 * Used when vision returns text but sparse structured rows.
 */
export function parseBunqDetailFromText(text: string): ParsedBankAppTransaction[] {
  const institution = detectBankAppInstitution(text, "bunq");
  const failed = FAILED_RE.test(text);
  const occurredAt = parseBankAppOccurredAt(text);
  if (!occurredAt) return [];

  const merchantMatch =
    text.match(/\b([A-Z][A-Za-z0-9 &.'-]{1,40})\s*>/m) ||
    text.match(/\b(Grab|Bolt|Uber|Foodpanda|Apple|Google)\b/i);
  const merchant = merchantMatch?.[1]?.trim() || "Okänd";

  const thbMatch = text.match(
    /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{2})\s*THB\b/i,
  );
  const eurMatch = text.match(
    /(-?\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|-?\d+,\d{2})\s*€/,
  );

  let originalAmountMinor: number | null = null;
  if (thbMatch) {
    try {
      originalAmountMinor = europeanAmountToMinor(thbMatch[1]!);
    } catch {
      originalAmountMinor = null;
    }
  }

  let displayAmountMinor: number | null = null;
  if (eurMatch) {
    try {
      displayAmountMinor = europeanAmountToMinor(
        eurMatch[1]!.replace(/^-/, ""),
      );
    } catch {
      displayAmountMinor = null;
    }
  }

  const ledger = pickLedgerAmount({
    amountMinor: displayAmountMinor,
    currency: displayAmountMinor != null ? "EUR" : null,
    originalAmountMinor,
    originalCurrency: originalAmountMinor != null ? "THB" : null,
    institution,
    merchant,
    direction: "debit",
    rawText: text,
    fullText: text,
    occurredAt,
  });
  if (!ledger && !failed) return [];

  const isCredit =
    /påfyllning|top\s*up|insättning|\+\s*\d/i.test(text) &&
    !/onlinebetalning|−|-\d/i.test(text);

  const direction = isCredit ? "credit" : "debit";
  // Re-plan with correct direction for annotation consistency.
  const planned =
    pickLedgerAmount({
      amountMinor: displayAmountMinor,
      currency: displayAmountMinor != null ? "EUR" : null,
      originalAmountMinor,
      originalCurrency: originalAmountMinor != null ? "THB" : null,
      institution,
      merchant,
      direction,
      rawText: text,
      fullText: text,
      occurredAt,
    }) ?? ledger;

  if (!planned) return [];

  return [
    {
      institution,
      merchant,
      direction,
      amountMinor: planned.amountMinor,
      currency: planned.currency,
      displayAmountMinor,
      displayCurrency: displayAmountMinor != null ? "EUR" : null,
      originalAmountMinor,
      originalCurrency: originalAmountMinor != null ? "THB" : null,
      annotationSv: planned.annotationSv,
      occurredAt,
      categoryHint: /resor|travel|flyg/i.test(text) ? "Resor" : null,
      failed,
      confidence: 0.75,
      raw: text.slice(0, 400),
      sourceIndex: 0,
    },
  ];
}

export function toBankAppEventCandidate(
  row: ParsedBankAppTransaction,
): BankAppEventCandidate {
  const fingerprint = buildBankAppFingerprint({
    institution: row.institution,
    merchant: row.merchant,
    direction: row.direction,
    amountMinor: row.amountMinor,
    currency: row.currency,
    occurredAt: row.occurredAt,
    originalAmountMinor: row.originalAmountMinor,
    originalCurrency: row.originalCurrency,
  });

  const dir = row.direction === "credit" ? "+" : "−";
  const kind = row.direction === "credit" ? "Insättning" : "Utgift";
  const amount = formatMoney(money(row.amountMinor, row.currency));
  const note = row.annotationSv ? ` · ${row.annotationSv}` : "";
  const labelSv = `${dir} ${kind} ${amount} · ${row.merchant}${note}`;

  return { ...row, fingerprint, labelSv };
}

export function selectImportableBankAppEvents(
  rows: ParsedBankAppTransaction[],
  existingFingerprints: Iterable<string>,
): SelectBankAppImportResult {
  const known = new Set(
    [...existingFingerprints].map((f) => f.trim()).filter(Boolean),
  );
  const failedCount = rows.filter((r) => r.failed).length;
  const viable = rows
    .filter((r) => !r.failed)
    .map(toBankAppEventCandidate)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  if (viable.length === 0) {
    return {
      status: "none",
      all: [],
      skippedFailedCount: failedCount,
      messageSv: failedCount
        ? "Bara misslyckade/streckade rader — inget att spara."
        : "Kunde inte läsa en komplett bankapp-transaktion (behöver belopp i THB/SEK + tidpunkt).",
    };
  }

  const selectedBatch = viable.filter(
    (e) => matchFingerprint(e.fingerprint.fingerprint, known).kind !== "exact",
  );
  const skippedDuplicateCount = viable.length - selectedBatch.length;

  if (selectedBatch.length === 0) {
    return {
      status: "all_known",
      all: viable,
      skippedDuplicateCount,
      skippedFailedCount: failedCount,
      messageSv:
        viable.length > 1
          ? `Alla ${viable.length} rörelser finns redan sparade i NUMA.`
          : "Den här utgiften finns redan sparad i NUMA — inget nytt att lägga till.",
    };
  }

  const parts: string[] = [];
  if (selectedBatch.length === 1) {
    parts.push(`Ny rörelse: ${selectedBatch[0]!.labelSv}.`);
  } else {
    parts.push(`${selectedBatch.length} nya rörelser från bankappen.`);
  }
  if (skippedDuplicateCount > 0) {
    parts.push(`${skippedDuplicateCount} redan sparade hoppades över.`);
  }
  if (failedCount > 0) {
    parts.push(`${failedCount} misslyckade hoppades över.`);
  }

  return {
    status: "ready",
    selectedBatch,
    all: viable,
    skippedDuplicateCount,
    skippedFailedCount: failedCount,
    messageSv: parts.join(" "),
  };
}
