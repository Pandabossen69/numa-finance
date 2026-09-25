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
import {
  DEFAULT_TIMEZONE,
  zonedDayKey,
  zonedWallTimeToUtcIso,
} from "@/domain/finance/datetime";
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

const MONTHS: Record<string, string> = {
  januari: "01",
  january: "01",
  jan: "01",
  februari: "02",
  february: "02",
  feb: "02",
  mars: "03",
  march: "03",
  mar: "03",
  april: "04",
  apr: "04",
  maj: "05",
  may: "05",
  juni: "06",
  june: "06",
  jun: "06",
  juli: "07",
  july: "07",
  jul: "07",
  augusti: "08",
  august: "08",
  aug: "08",
  september: "09",
  sep: "09",
  sept: "09",
  oktober: "10",
  october: "10",
  okt: "10",
  oct: "10",
  november: "11",
  nov: "11",
  december: "12",
  dec: "12",
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

function monthNumber(token: string): string | null {
  return MONTHS[token.toLowerCase().replace(/\./g, "")] ?? null;
}

function validYmd(year: string, month: string, day: string): boolean {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

function bangkokDayKey(now: Date, deltaDays: number): string {
  const key = zonedDayKey(now, DEFAULT_TIMEZONE);
  const anchor = Date.parse(`${key}T12:00:00+07:00`);
  return zonedDayKey(new Date(anchor + deltaDays * 86_400_000), DEFAULT_TIMEZONE);
}

function wallIso(
  year: string,
  month: string,
  day: string,
  hour: string,
  minute: string,
  second = "00",
): string | null {
  const mo = month.padStart(2, "0");
  const dd = day.padStart(2, "0");
  const hh = hour.padStart(2, "0");
  const mm = minute.padStart(2, "0");
  const ss = second.padStart(2, "0");
  if (!validYmd(year, mo, dd)) return null;
  if (Number(hh) > 23 || Number(mm) > 59 || Number(ss) > 59) return null;
  try {
    return zonedWallTimeToUtcIso(
      `${year}-${mo}-${dd}T${hh}:${mm}:${ss}`,
      DEFAULT_TIMEZONE,
    );
  } catch {
    return null;
  }
}

function parseBankAppOccurredLine(line: string, now: Date): string | null {
  const iso = line.match(
    /(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (iso) {
    const hit = wallIso(
      iso[1]!,
      iso[2]!,
      iso[3]!,
      iso[4] ?? "12",
      iso[5] ?? "00",
      iso[6] ?? "00",
    );
    if (hit) return hit;
  }

  const named = line.match(
    /(\d{1,2})\s+([A-Za-zåäö.]+)\s+(\d{4})(?:(?:\s+|,\s*)(\d{1,2})[:.](\d{2})(?::(\d{2}))?)?/i,
  );
  if (named) {
    const month = monthNumber(named[2]!);
    if (month) {
      const hit = wallIso(
        named[3]!,
        month,
        named[1]!,
        named[4] ?? "12",
        named[5] ?? "00",
        named[6] ?? "00",
      );
      if (hit) return hit;
    }
  }

  const numeric = line.match(
    /(?:^|\s)(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[T\s]+(\d{1,2})[:.](\d{2})(?::(\d{2}))?)?(?!\d)/,
  );
  if (numeric) {
    const hit = wallIso(
      numeric[3]!,
      numeric[2]!,
      numeric[1]!,
      numeric[4] ?? "12",
      numeric[5] ?? "00",
      numeric[6] ?? "00",
    );
    if (hit) return hit;
  }

  const relative = line.match(
    /^(idag|igår|igar|today|yesterday)(?:[,\s]+(\d{1,2})[:.](\d{2})(?::(\d{2}))?)?$/i,
  );
  if (relative) {
    const word = relative[1]!.toLowerCase();
    const delta =
      word === "igår" || word === "igar" || word === "yesterday" ? -1 : 0;
    const [year, month, day] = bangkokDayKey(now, delta).split("-");
    return wallIso(
      year!,
      month!,
      day!,
      relative[2] ?? "12",
      relative[3] ?? "00",
      relative[4] ?? "00",
    );
  }

  const timeOnly = line.match(/^(\d{1,2})[:.](\d{2})(?::(\d{2}))?$/);
  if (timeOnly) {
    const [year, month, day] = bangkokDayKey(now, 0).split("-");
    return wallIso(year!, month!, day!, timeOnly[1]!, timeOnly[2]!, timeOnly[3] ?? "00");
  }

  return null;
}

/**
 * Bank-app timestamps as Bangkok wall time.
 * Accepts ISO local, Swedish/English month names (short or with a dot),
 * day-first numbers, Idag/Igår/Today/Yesterday, and a clock time on the
 * capture day.
 */
export function parseBankAppOccurredAt(
  raw: string | null | undefined,
  options?: { now?: Date },
): string | null {
  if (!raw?.trim()) return null;
  const now = options?.now ?? new Date();
  for (const line of raw.split(/\r?\n/)) {
    const hit = parseBankAppOccurredLine(line.trim(), now);
    if (hit) return hit;
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

const AMOUNT_CURRENCY_RE =
  /(\d{1,3}(?:[ \u00a0.]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{2})\s*(€|eur|sek|kr|kronor|thb|฿|usd)(?![a-z])/gi;

/** Currency written next to an amount in OCR text. €/EUR wins over a THB annotation. */
export function inferAmountCurrency(
  text: string | null | undefined,
): CurrencyCode | null {
  if (!text) return null;
  const found = new Set<CurrencyCode>();
  for (const match of text.matchAll(AMOUNT_CURRENCY_RE)) {
    const code = parseCurrencyToken(match[2]);
    if (code) found.add(code);
  }
  if (found.has("SEK") && !found.has("EUR")) return "SEK";
  if (found.has("USD") && !found.has("EUR")) return "USD";
  if (found.has("EUR")) return "EUR";
  if (found.has("THB")) return "THB";
  if (found.has("SEK")) return "SEK";
  if (found.has("USD")) return "USD";
  return null;
}

/**
 * Card currency for a bank-app row.
 * An explicit SEK/kr (or USD/THB) wins. A vision "EUR" is dropped when the
 * amount text only says SEK — the prompt biases missing cards toward euro,
 * which turned «−54,12 SEK» into «−54,12 €» and a new EUR «Bankapp» account.
 * Returns null when nothing was named, so we do not invent EUR.
 */
export function resolveBankAppPostedCurrency(input: {
  currency?: string | null;
  originalCurrency?: string | null;
  /** The transaction line itself («−54,12 SEK»). Wins over a euro header. */
  rawText?: string | null;
  /** Whole screenshot, used only when the line itself has no currency. */
  screenText?: string | null;
}): CurrencyCode | null {
  const explicit = parseCurrencyToken(input.currency);
  const fromRow = inferAmountCurrency(input.rawText);
  const fromScreen = inferAmountCurrency(input.screenText);
  // The amount's own suffix beats a vision EUR default and an account header in €.
  if (fromRow === "SEK" || fromRow === "USD") return fromRow;
  if (explicit === "SEK" || explicit === "USD" || explicit === "THB") {
    return explicit;
  }
  if (explicit === "EUR") {
    if (fromScreen === "SEK" || fromScreen === "USD") return fromScreen;
    return "EUR";
  }
  if (fromRow) return fromRow;
  if (fromScreen) return fromScreen;
  const original = parseCurrencyToken(input.originalCurrency);
  if (original && original !== "THB") return original;
  return null;
}

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
  options?: {
    institutionHint?: string | null;
    fullText?: string | null;
    capturedAt?: Date | string | null;
  },
): ParsedBankAppTransaction[] {
  const institution = detectBankAppInstitution(
    options?.fullText ?? "",
    options?.institutionHint,
  );
  const capturedAt = options?.capturedAt ? new Date(options.capturedAt) : new Date();
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
    const displayCurrency = resolveBankAppPostedCurrency({
      currency: row.currency,
      originalCurrency:
        typeof row.originalCurrency === "string" ? row.originalCurrency : null,
      rawText: row.rawText,
      screenText: options?.fullText,
    });
    const originalAmountMinor = majorFieldToMinor(row.originalAmountMajor);
    const originalCurrency = parseCurrencyToken(row.originalCurrency) ??
      (row.originalCurrency ? String(row.originalCurrency).toUpperCase() : null);

    const occurredAt = parseBankAppOccurredAt(
      typeof row.occurredAt === "string" ? row.occurredAt : null,
      { now: capturedAt },
    );
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
        currency:
          ledger?.currency ??
          displayCurrency ??
          parseCurrencyToken(row.currency) ??
          "EUR",
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
export function parseBunqDetailFromText(
  text: string,
  options?: { now?: Date },
): ParsedBankAppTransaction[] {
  const institution = detectBankAppInstitution(text, "bunq");
  const failed = FAILED_RE.test(text);
  const occurredAt = parseBankAppOccurredAt(text, options);
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
  const sekMatch = text.match(
    /(-?\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|-?\d+,\d{2})\s*(?:SEK|kr|kronor)\b/i,
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
  let displayCurrency: CurrencyCode | null = null;
  const amountMatch = eurMatch ?? sekMatch;
  if (amountMatch) {
    try {
      displayAmountMinor = europeanAmountToMinor(
        amountMatch[1]!.replace(/^-/, ""),
      );
      displayCurrency = eurMatch ? "EUR" : "SEK";
    } catch {
      displayAmountMinor = null;
      displayCurrency = null;
    }
  }

  const ledger = pickLedgerAmount({
    amountMinor: displayAmountMinor,
    currency: displayCurrency,
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
      currency: displayCurrency,
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
      displayCurrency,
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

export type FotaVisionFieldGap = {
  amount: "present" | "null";
  currency: "present" | "null";
  occurredAt: "present" | "null";
};

/** Redacted drop summary. Values, merchants and image bytes stay out. */
export function fotaVisionNoneSummary(input: {
  model?: string | null;
  mode?: string | null;
  detectedKind?: string | null;
  rows: BankAppVisionRow[];
  now?: Date;
}): {
  model: string | null;
  mode: string | null;
  detectedKind: string | null;
  rowCount: number;
  rows: FotaVisionFieldGap[];
} {
  const now = input.now ?? new Date();
  return {
    model: input.model ?? null,
    mode: input.mode ?? null,
    detectedKind: input.detectedKind ?? null,
    rowCount: input.rows.length,
    rows: input.rows.map((row) => ({
      amount: majorFieldToMinor(row.amountMajor) == null ? "null" : "present",
      currency:
        parseCurrencyToken(typeof row.currency === "string" ? row.currency : null) ==
        null
          ? "null"
          : "present",
      occurredAt:
        parseBankAppOccurredAt(
          typeof row.occurredAt === "string" ? row.occurredAt : null,
          { now },
        ) == null
          ? "null"
          : "present",
    })),
  };
}

export function warnFotaVisionNone(
  summary: ReturnType<typeof fotaVisionNoneSummary>,
) {
  console.warn("[fota-vision]", summary);
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
