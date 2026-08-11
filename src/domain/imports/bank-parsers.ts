/**
 * Bangkok Bank SMS — English templates used on payment + PromptPay SMS.
 *
 * Debit examples:
 *   Withdrawal/transfer/payment from your account X6591 of Bt 65.00 via MOBILE;
 *   the available balance is Bt 10,693.04.
 *   Withdrawal from your account X6591 of Bt 50.00 via MOBILE; the available balance is Bt 12,118.04.
 *
 * Credit example:
 *   PromptPay transfer to your account X6591 of Bt 3,400.00 via MOBILE;
 *   the available balance is Bt 10,108.04
 *
 * Screenshots often contain several older SMS. Domain rules:
 * 1. Parse every message
 * 2. Fingerprint each (never amount alone — include balance-after)
 * 3. Import only the newest message that is not already known
 * 4. Same SMS in a later screenshot is skipped (exact fingerprint match)
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
  /** 0 = first chunk in source text (often older in conversation threads). */
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

/** Start of a new Bangkok Bank bubble (lookbehind-safe split). */
const SMS_START =
  /(?=Withdrawal\/transfer\/payment\b)|(?=Withdrawal\s+from\s+your\s+account\b)|(?=Deposit\/transfer\/payment\b)|(?=Deposit\s+to\s+your\s+account\b)|(?=PromptPay\s+transfer\s+to\b)|(?=You have received\b)|(?=Successful transaction\b)/i;

const AMOUNT_OF_BT = /of\s+Bt\s*([\d,]+(?:\.\d{1,2})?)/i;
const BALANCE_BT = /available balance is Bt\s*([\d,]+(?:\.\d{1,2})?)/i;
const ACCOUNT_RE =
  /(?:your\s+)?account\s+(X\d{3,}|\*{2,}\d{3,}|\d{3,})/i;

function detectDirection(chunk: string): "debit" | "credit" {
  const t = chunk.toLowerCase();
  // Credits first — "transfer to" must win over generic "transfer".
  if (
    /promptpay\s+transfer\s+to/.test(t) ||
    /transfer\s+to\s+your\s+account/.test(t) ||
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
    /payment\s+from\s+your\s+account/.test(t) ||
    (/debit/.test(t) && !/credit/.test(t))
  ) {
    return "debit";
  }
  // Default debit for unknown Bangkok "from your account" money moves.
  return "debit";
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
      t.includes("available balance is bt") ||
      t.includes("from your account") ||
      t.includes("to your account") ||
      t.includes("withdrawal/transfer/payment") ||
      t.includes("withdrawal from") ||
      t.includes("promptpay transfer")
    );
  }

  parse(input: BankMessageParseInput): ParsedBankMessage[] {
    const chunks = splitBankSmsChunks(input.text);
    const results: ParsedBankMessage[] = [];

    chunks.forEach((chunk, sourceIndex) => {
      const amountMatch = chunk.match(AMOUNT_OF_BT);
      const balanceMatch = chunk.match(BALANCE_BT);
      const accountMatch = chunk.match(ACCOUNT_RE);

      if (!amountMatch && !balanceMatch) return;

      const direction = detectDirection(chunk);
      const amountMinor = amountMatch
        ? majorStringToMinor(amountMatch[1]!)
        : null;
      const balanceAfterMinor = balanceMatch
        ? majorStringToMinor(balanceMatch[1]!)
        : null;

      results.push({
        institution: "Bangkok Bank",
        maskedAccount: normalizeMaskedAccount(accountMatch?.[1] ?? null),
        direction,
        amountMinor,
        currency: "THB",
        balanceAfterMinor,
        channel: detectChannel(chunk),
        confidence: amountMatch && balanceMatch ? 0.95 : 0.65,
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

  // Last resort: split after each balance sentence if several appear.
  const byBalance = normalized
    .split(/(?<=available balance is Bt\s*[\d,]+(?:\.\d{1,2})?\.?)/i)
    .map((c) => c.trim())
    .filter((c) => /Bt\s*[\d,]/i.test(c));

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
    message.amountMinor != null && message.balanceAfterMinor != null
      ? message.direction === "credit"
        ? message.balanceAfterMinor - message.amountMinor
        : message.balanceAfterMinor + message.amountMinor
      : null;

  let fingerprint: FingerprintResult | null = null;
  if (
    message.amountMinor != null &&
    message.direction &&
    message.maskedAccount
  ) {
    fingerprint = buildTransactionFingerprint({
      institution: message.institution,
      maskedAccount: message.maskedAccount,
      direction: message.direction,
      amountMinor: message.amountMinor,
      balanceAfterMinor: message.balanceAfterMinor,
      channel: message.channel,
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
      ? ` · saldo efter ฿${(message.balanceAfterMinor / 100).toLocaleString(
          "sv-SE",
          { minimumFractionDigits: 2, maximumFractionDigits: 2 },
        )}`
      : "";
  const dir = message.direction === "credit" ? "Insättning" : "Utgift";
  const acct = message.maskedAccount ? ` · …${message.maskedAccount}` : "";
  return `${dir} ${amount}${acct}${bal}`;
}

/**
 * Newest-first ordering using balance-after chain when possible.
 * Falls back to reverse source order (conversation: last bubble = newest).
 */
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

  // Conversation screenshots: later chunks are usually newer.
  return [...events].sort((a, b) => b.sourceIndex - a.sourceIndex);
}

/**
 * Pick the newest bank event that is not already fingerprinted in the ledger.
 */
export function selectImportableBankEvent(
  messages: ParsedBankMessage[],
  existingFingerprints: Iterable<string>,
): SelectImportableResult {
  const known = new Set(
    [...existingFingerprints].map((f) => f.trim()).filter(Boolean),
  );
  const all = orderNewestFirst(messages.map(toBankEventCandidate));

  if (all.length === 0) {
    return {
      status: "none",
      all,
      messageSv: "Ingen bank-SMS kunde läsas i bilden.",
    };
  }

  let skippedDuplicateCount = 0;
  for (let i = 0; i < all.length; i++) {
    const event = all[i]!;
    const fp = event.fingerprint?.fingerprint;
    if (fp && matchFingerprint(fp, known).kind === "exact") {
      skippedDuplicateCount += 1;
      continue;
    }

    // Newest-first: index i means i newer SMS already known; rest are older.
    const skippedOlderCount = Math.max(0, all.length - i - 1);
    const parts = [`Senaste nya: ${event.labelSv}.`];
    if (skippedDuplicateCount > 0) {
      parts.push(`${skippedDuplicateCount} fanns redan (samma SMS).`);
    }
    if (skippedOlderCount > 0) {
      parts.push(`${skippedOlderCount} äldre i bilden hoppades över.`);
    }

    return {
      status: "ready",
      selected: event,
      all,
      skippedOlderCount,
      skippedDuplicateCount,
      messageSv: parts.join(" "),
    };
  }

  return {
    status: "all_known",
    all,
    skippedDuplicateCount,
    messageSv: `Alla ${all.length} SMS i bilden finns redan — inget nytt att spara.`,
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
