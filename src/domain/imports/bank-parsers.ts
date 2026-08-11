/**
 * Import rules (Bangkok Bank SMS) — never invent money.
 *
 * 1. Parse every bubble; fingerprint = institution+account+direction+amount+balanceAfter
 *    (channel excluded when balanceAfter exists — same SMS must never double-import).
 * 2. Import ONLY the newest SMS in the screenshot if it is unknown.
 *    If the newest is already known → nothing to import (never catch-up older
 *    from the same shot — that would rewind saldo).
 * 3. Saldo checkpoint = that SMS's "available balance" only.
 * 4. Same SMS in another photo → fingerprint match → skip.
 * 5. Incomplete / unclear direction → do not invent debit or ฿0.
 */

import {
  buildTransactionFingerprint,
  matchFingerprint,
  type FingerprintResult,
} from "@/domain/finance/fingerprint";

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
      selected: BankEventCandidate;
      all: BankEventCandidate[];
      skippedOlderCount: number;
      skippedDuplicateCount: number;
      /** Always true when ready — only newest unknown tip is selected. */
      updatesBalance: true;
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

/** Bangkok Bank writes Bt or TH (OCR/locale variant of THB). */
const CURRENCY_TOKEN = "(?:Bt|THB?|บาท)";

const SMS_START = new RegExp(
  [
    "(?=Withdrawal\\/transfer\\/payment\\b)",
    "(?=Withdrawal\\s+from\\s+your\\s+account\\b)",
    "(?=Deposit\\/transfer\\/payment\\b)",
    "(?=Deposit\\s+to\\s+your\\s+account\\b)",
    "(?=PromptPay\\s+transfer(?:\\s+in)?\\s+to\\b)",
    "(?=MoneyPlus\\s+transfer(?:\\s+in)?\\s+to\\b)",
    "(?=You have received\\b)",
    "(?=Successful transaction\\b)",
  ].join("|"),
  "i",
);

const AMOUNT_OF_CURRENCY = new RegExp(
  `of\\s+${CURRENCY_TOKEN}\\s*([\\d,]+(?:\\.\\d{1,2})?)`,
  "i",
);
const BALANCE_CURRENCY = new RegExp(
  `available balance is\\s+${CURRENCY_TOKEN}\\s*([\\d,]+(?:\\.\\d{1,2})?)`,
  "i",
);
const ACCOUNT_RE =
  /(?:your\s+)?account\s+(X\d{3,}|\*{2,}\d{3,}|\d{3,})/i;

function detectDirection(chunk: string): "debit" | "credit" | null {
  const t = chunk.toLowerCase();
  if (
    /promptpay\s+transfer(?:\s+in)?\s+to/.test(t) ||
    /moneyplus\s+transfer(?:\s+in)?\s+to/.test(t) ||
    /transfer(?:\s+in)?\s+to\s+your\s+account/.test(t) ||
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
    /payment\s+from\s+your\s+account/.test(t)
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
  return raw.replace(/[^\dA-Z]/gi, "").slice(-4) || raw;
}

export class BangkokBankSmsParser implements BankMessageParser {
  readonly institutionId = "bangkok_bank";

  canParse(input: BankMessageParseInput): boolean {
    const t = input.text.toLowerCase();
    return (
      input.institution.toLowerCase().includes("bangkok") ||
      /available balance is\s+(?:bt|thb?)/.test(t) ||
      t.includes("from your account") ||
      t.includes("to your account") ||
      t.includes("withdrawal/transfer/payment") ||
      t.includes("withdrawal from") ||
      t.includes("promptpay transfer") ||
      t.includes("moneyplus transfer")
    );
  }

  parse(input: BankMessageParseInput): ParsedBankMessage[] {
    const chunks = splitBankSmsChunks(input.text);
    const results: ParsedBankMessage[] = [];

    chunks.forEach((chunk, sourceIndex) => {
      const amountMatch = chunk.match(AMOUNT_OF_CURRENCY);
      const balanceMatch = chunk.match(BALANCE_CURRENCY);
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
        `(?<=available balance is\\s+${CURRENCY_TOKEN}\\s*[\\d,]+(?:\\.\\d{1,2})?\\.?)`,
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
      // Stable across MOBILE/ATM OCR noise when balanceAfter is known.
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
  const amount =
    message.amountMinor != null
      ? `฿${(message.amountMinor / 100).toLocaleString("sv-SE", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "okänt belopp";
  const bal =
    message.balanceAfterMinor != null
      ? ` · saldo ฿${(message.balanceAfterMinor / 100).toLocaleString("sv-SE", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "";
  const dir = message.direction === "credit" ? "Insättning" : "Utgift";
  const acct = message.maskedAccount ? ` · …${message.maskedAccount}` : "";
  return `${dir} ${amount}${acct}${bal}`;
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
 * Only the newest SMS may be imported. If it is already known, stop —
 * never import an older bubble from the same screenshot (saldo safety).
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

  const newest = all[0]!;
  const fp = newest.fingerprint!.fingerprint;
  const skippedOlderCount = Math.max(0, all.length - 1);

  if (matchFingerprint(fp, known).kind === "exact") {
    return {
      status: "all_known",
      all,
      skippedDuplicateCount: 1,
      messageSv:
        skippedOlderCount > 0
          ? `Senaste SMS finns redan. ${skippedOlderCount} äldre i bilden hoppades över.`
          : "Det här SMS:et finns redan — inget nytt att spara.",
    };
  }

  const parts = [`Senaste nya: ${newest.labelSv}.`];
  if (skippedOlderCount > 0) {
    parts.push(`${skippedOlderCount} äldre i bilden hoppades över.`);
  }

  return {
    status: "ready",
    selected: newest,
    all,
    skippedOlderCount,
    skippedDuplicateCount: 0,
    updatesBalance: true,
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
