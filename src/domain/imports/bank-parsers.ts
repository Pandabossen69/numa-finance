/**
 * Import rules (Bangkok Bank SMS / Hugo) — never invent money.
 *
 * Typical screenshot: 3–6 bubbles, mix of Withdrawal (from) and PromptPay (to),
 * currency Bt, account like X6591, every line ends with available balance.
 * iMessage shows "idag" but the SMS body has NO payment date — so identity is:
 *
 *   fingerprint = bank + konto + +/- + belopp + available balance
 *
 * 1. Parse every bubble (never invent debit/credit or ฿0).
 * 2. Import ALL unknown SMS in the shot (credits and debits).
 * 3. Saldo on Hem = newest bubble's available balance only.
 * 4. Known fingerprint in Supabase → skip that bubble (overlap-safe).
 * 5. Channel (MOBILE/ATM) ignored in fingerprint when balance exists.
 */

import {
  buildTransactionFingerprint,
  matchFingerprint,
  type FingerprintResult,
} from "@/domain/finance/fingerprint";
import { formatMoney, money } from "@/domain/money";

export type BankMessageParseInput = {
  institution: string;
  text: string;
};

export type ParsedBankMessage = {
  institution: string;
  maskedAccount: string | null;
  direction: "debit" | "credit" | null;
  amountMinor: number | null;
  currency: "THB" | "SEK" | null;
  balanceAfterMinor: number | null;
  channel: string | null;
  confidence: number;
  raw: string;
  sourceIndex: number;
};

export type BankEventCandidate = ParsedBankMessage & {
  fingerprint: FingerprintResult | null;
  labelSv: string;
  priorBalanceMinor: number | null;
};

export type SelectImportableResult =
  | {
      status: "ready";
      /** Newest unknown — used for primary UI / saldo tip when it is the image tip. */
      selected: BankEventCandidate;
      /** All unknown events, newest first. */
      selectedBatch: BankEventCandidate[];
      all: BankEventCandidate[];
      skippedOlderCount: number;
      skippedDuplicateCount: number;
      /**
       * True only when the newest SMS in the image is newly imported.
       * Older-unknown re-imports must not rewrite Hem tip / verifiedAt.
       */
      updatesBalance: boolean;
      /** Available balance from the newest SMS in the image (informational). */
      tipBalanceAfterMinor: number;
      messageSv: string;
    }
  | {
      status: "all_known";
      all: BankEventCandidate[];
      skippedDuplicateCount: number;
      messageSv: string;
    }
  | {
      status: "none";
      all: BankEventCandidate[];
      messageSv: string;
    };

export interface BankMessageParser {
  readonly institutionId: string;
  canParse(input: BankMessageParseInput): boolean;
  parse(input: BankMessageParseInput): ParsedBankMessage[];
}

/** Bangkok Bank writes Bt, TH, or THB. */
const CURRENCY_TOKEN = "(?:Bt|THB?|บาท)";

const SMS_START = new RegExp(
  [
    "(?=Withdrawal\\/transfer\\/payment\\b)",
    "(?=Withdrawal\\s+from\\s+(?:your\\s+)?account\\b)",
    "(?=Deposit\\/transfer\\/payment\\b)",
    "(?=Deposit\\s+to\\s+(?:your\\s+)?account\\b)",
    "(?=PromptPay\\s+transfer(?:\\s+in)?\\s+to\\b)",
    "(?=MoneyPlus\\s+transfer(?:\\s+in)?\\s+to\\b)",
    "(?=You have received\\b)",
    "(?=Successful transaction\\b)",
  ].join("|"),
  "i",
);

/** of Bt 65.00  |  amount THB 3,400.00 */
const AMOUNT_PATTERNS = [
  new RegExp(`of\\s+${CURRENCY_TOKEN}\\s*([\\d,]+(?:\\.\\d{1,2})?)`, "i"),
  new RegExp(
    `amount\\s+${CURRENCY_TOKEN}\\s*([\\d,]+(?:\\.\\d{1,2})?)`,
    "i",
  ),
];

/** available balance is Bt …  |  Bal available is THB … */
const BALANCE_PATTERNS = [
  new RegExp(
    `available balance is\\s+${CURRENCY_TOKEN}\\s*([\\d,]+(?:\\.\\d{1,2})?)`,
    "i",
  ),
  new RegExp(
    `bal(?:ance)?\\s+available\\s+is\\s+${CURRENCY_TOKEN}\\s*([\\d,]+(?:\\.\\d{1,2})?)`,
    "i",
  ),
];

const ACCOUNT_RE =
  /(?:your\s+)?account\s+(X+\d*|\*{2,}\d+|\d{3,}|X{2,}\d+)/i;

function firstMatch(
  chunk: string,
  patterns: RegExp[],
): RegExpMatchArray | null {
  for (const re of patterns) {
    const m = chunk.match(re);
    if (m) return m;
  }
  return null;
}

function detectDirection(chunk: string): "debit" | "credit" | null {
  const t = chunk.toLowerCase();
  if (
    /promptpay\s+transfer(?:\s+in)?\s+to/.test(t) ||
    /moneyplus\s+transfer(?:\s+in)?\s+to/.test(t) ||
    /transfer(?:\s+in)?\s+to\s+(?:your\s+)?account/.test(t) ||
    /deposit(?:\/transfer\/payment)?\s+to/.test(t) ||
    /you have received/.test(t) ||
    /credit\s+to/.test(t) ||
    /transferred\s+to\s+your/.test(t)
  ) {
    return "credit";
  }
  if (
    /withdrawal/.test(t) ||
    /transfer\/payment\s+from/.test(t) ||
    /payment\s+from\s+(?:your\s+)?account/.test(t)
  ) {
    return "debit";
  }
  return null;
}

function detectChannel(chunk: string): string | null {
  if (/via\s+MOBILE/i.test(chunk)) return "mobile";
  if (/via\s+ATM/i.test(chunk)) return "atm";
  if (/via\s+PROMPTpay/i.test(chunk)) return "promptpay";
  return null;
}

function normalizeMaskedAccount(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(-4);
  if (digits.length >= 1) return digits.padStart(Math.min(4, digits.length), "0");
  return raw.replace(/[^\dA-Z]/gi, "").slice(-4) || raw;
}

function looksLikeBankBalancePhrase(t: string): boolean {
  return (
    /available balance is\s+(?:bt|thb?)/.test(t) ||
    /bal(?:ance)?\s+available\s+is\s+(?:bt|thb?)/.test(t)
  );
}

export class BangkokBankSmsParser implements BankMessageParser {
  readonly institutionId = "bangkok_bank";

  canParse(input: BankMessageParseInput): boolean {
    const t = input.text.toLowerCase();
    return (
      input.institution.toLowerCase().includes("bangkok") ||
      looksLikeBankBalancePhrase(t) ||
      t.includes("from your account") ||
      t.includes("from account") ||
      t.includes("to your account") ||
      t.includes("withdrawal/transfer/payment") ||
      t.includes("withdrawal from") ||
      t.includes("promptpay transfer") ||
      t.includes("moneyplus transfer") ||
      /amount\s+(?:bt|thb?)/.test(t)
    );
  }

  parse(input: BankMessageParseInput): ParsedBankMessage[] {
    const chunks = splitBankSmsChunks(input.text);
    const results: ParsedBankMessage[] = [];

    chunks.forEach((chunk, sourceIndex) => {
      const amountMatch = firstMatch(chunk, AMOUNT_PATTERNS);
      const balanceMatch = firstMatch(chunk, BALANCE_PATTERNS);
      const accountMatch = chunk.match(ACCOUNT_RE);
      if (!amountMatch || !balanceMatch) return;

      const direction = detectDirection(chunk);
      if (!direction) return;

      results.push({
        institution: "Bangkok Bank",
        maskedAccount: normalizeMaskedAccount(accountMatch?.[1] ?? null),
        direction,
        amountMinor: majorStringToMinor(amountMatch[1]!),
        currency: "THB",
        balanceAfterMinor: majorStringToMinor(balanceMatch[1]!),
        channel: detectChannel(chunk),
        confidence: 0.95,
        raw: chunk.trim(),
        sourceIndex,
      });
    });

    return results;
  }
}

export function splitBankSmsChunks(text: string): string[] {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  if (!normalized) return [];

  const byBoundary = normalized
    .split(SMS_START)
    .map((c) => c.trim())
    .filter(Boolean);

  if (byBoundary.length > 1) return byBoundary;

  const byBlank = normalized
    .split(/\n{2,}/)
    .map((c) => c.trim())
    .filter(Boolean);

  if (byBlank.length > 1) return byBlank;

  const byBalance = normalized
    .split(
      new RegExp(
        `(?<=(?:available balance is|bal(?:ance)?\\s+available\\s+is)\\s+${CURRENCY_TOKEN}\\s*[\\d,]+(?:\\.\\d{1,2})?\\.?)`,
        "i",
      ),
    )
    .map((c) => c.trim())
    .filter((c) => new RegExp(`${CURRENCY_TOKEN}\\s*[\\d,]`, "i").test(c));

  if (byBalance.length > 1) return byBalance;

  return [normalized];
}

export function majorStringToMinor(value: string): number {
  const normalized = value.replace(/,/g, "").trim();
  const major = Number(normalized);
  if (!Number.isFinite(major)) {
    throw new Error(`Cannot parse bank amount: ${value}`);
  }
  return Math.round(major * 100);
}

export function toBankEventCandidate(
  message: ParsedBankMessage,
): BankEventCandidate {
  const priorBalanceMinor =
    message.amountMinor != null &&
    message.balanceAfterMinor != null &&
    message.direction
      ? message.direction === "credit"
        ? message.balanceAfterMinor - message.amountMinor
        : message.balanceAfterMinor + message.amountMinor
      : null;

  let fingerprint: FingerprintResult | null = null;
  if (
    message.amountMinor != null &&
    message.balanceAfterMinor != null &&
    message.direction &&
    message.maskedAccount
  ) {
    fingerprint = buildTransactionFingerprint({
      institution: message.institution,
      maskedAccount: message.maskedAccount,
      direction: message.direction,
      amountMinor: message.amountMinor,
      balanceAfterMinor: message.balanceAfterMinor,
      channel: null,
    });
  }

  return {
    ...message,
    fingerprint,
    priorBalanceMinor,
    labelSv: formatBankEventLabel(message),
  };
}

export function formatBankEventLabel(message: ParsedBankMessage): string {
  const currency = message.currency === "SEK" ? "SEK" : "THB";
  const amount =
    message.amountMinor != null
      ? formatMoney(money(message.amountMinor, currency))
      : "okänt belopp";
  const bal =
    message.balanceAfterMinor != null
      ? ` · saldo ${formatMoney(money(message.balanceAfterMinor, currency))}`
      : "";
  const dir = message.direction === "credit" ? "+" : "−";
  const kind = message.direction === "credit" ? "Insättning" : "Utgift";
  const acct = message.maskedAccount ? ` · …${message.maskedAccount}` : "";
  return `${dir} ${kind} ${amount}${acct}${bal}`;
}

export function orderNewestFirst(
  events: BankEventCandidate[],
): BankEventCandidate[] {
  if (events.length <= 1) return [...events];

  const withChain = events.filter(
    (e) => e.amountMinor != null && e.balanceAfterMinor != null && e.direction,
  );

  if (withChain.length >= 2) {
    const tips = withChain.filter((e) => {
      const usedAsPrior = withChain.some(
        (other) =>
          other !== e &&
          other.priorBalanceMinor != null &&
          other.priorBalanceMinor === e.balanceAfterMinor,
      );
      return !usedAsPrior;
    });

    if (tips.length === 1) {
      const ordered: BankEventCandidate[] = [];
      let cursor: BankEventCandidate | undefined = tips[0];
      const guard = new Set<string>();
      while (cursor && !guard.has(cursor.raw)) {
        ordered.push(cursor);
        guard.add(cursor.raw);
        const priorBal: number | null = cursor.priorBalanceMinor;
        cursor =
          priorBal != null
            ? withChain.find((e) => e.balanceAfterMinor === priorBal)
            : undefined;
      }
      if (ordered.length === withChain.length) return ordered;
      if (ordered.length >= 1) {
        const rest = events.filter((e) => !ordered.includes(e));
        return [...ordered, ...rest];
      }
    }
  }

  return [...events].sort((a, b) => b.sourceIndex - a.sourceIndex);
}

/**
 * Import every unknown SMS in the screenshot. Saldo = newest bubble's
 * available balance. Credits (+) and debits (−) are both included.
 */
export function selectImportableBankEvent(
  messages: ParsedBankMessage[],
  existingFingerprints: Iterable<string>,
): SelectImportableResult {
  const known = new Set(
    [...existingFingerprints].map((f) => f.trim()).filter(Boolean),
  );
  const all = orderNewestFirst(
    messages
      .map(toBankEventCandidate)
      .filter((e) => e.fingerprint != null && e.amountMinor != null),
  );

  if (all.length === 0) {
    return {
      status: "none",
      all,
      messageSv: "Ingen komplett bank-SMS kunde läsas (behöver belopp + saldo).",
    };
  }

  const selectedBatch = all.filter(
    (e) => matchFingerprint(e.fingerprint!.fingerprint, known).kind !== "exact",
  );
  const skippedDuplicateCount = all.length - selectedBatch.length;

  if (selectedBatch.length === 0) {
    return {
      status: "all_known",
      all,
      skippedDuplicateCount,
      messageSv:
        all.length > 1
          ? `Alla ${all.length} SMS i bilden finns redan.`
          : "Det här SMS:et finns redan — inget nytt att spara.",
    };
  }

  const tip = all[0]!;
  const tipInBatch = selectedBatch[0] === tip || selectedBatch.includes(tip);
  // Always use newest-in-image balance as Hem truth when confirming this shot.
  if (tip.balanceAfterMinor == null) {
    return {
      status: "none",
      all,
      messageSv: "Senaste SMS saknar saldo — ta en tydligare bild.",
    };
  }

  const credits = selectedBatch.filter((e) => e.direction === "credit").length;
  const debits = selectedBatch.filter((e) => e.direction === "debit").length;
  const parts: string[] = [];
  if (selectedBatch.length === 1) {
    parts.push(`Ny rörelse: ${selectedBatch[0]!.labelSv}.`);
  } else {
    parts.push(
      `${selectedBatch.length} nya rörelser (${credits} in · ${debits} ut).`,
    );
  }
  if (tipInBatch) {
    parts.push("Saldo sätts från senaste SMS.");
  }
  if (skippedDuplicateCount > 0) {
    parts.push(`${skippedDuplicateCount} redan sparade hoppades över.`);
  }

  return {
    status: "ready",
    selected: tipInBatch ? tip : selectedBatch[0]!,
    selectedBatch,
    all,
    skippedOlderCount: skippedDuplicateCount,
    skippedDuplicateCount,
    updatesBalance: tipInBatch,
    tipBalanceAfterMinor: tip.balanceAfterMinor,
    messageSv: parts.join(" "),
  };
}

export class BankParserRegistry {
  constructor(private readonly parsers: BankMessageParser[]) {}

  parse(input: BankMessageParseInput): ParsedBankMessage[] {
    const parser = this.parsers.find((p) => p.canParse(input));
    if (!parser) return [];
    return parser.parse(input);
  }
}

export const defaultBankParserRegistry = new BankParserRegistry([
  new BangkokBankSmsParser(),
]);
