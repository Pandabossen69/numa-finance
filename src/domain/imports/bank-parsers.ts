/**
 * Extensible bank-message parser architecture.
 * Phase 0 ships the interface + a Bangkok Bank SMS shape recognizer stub
 * that operates on already-structured fields (not brittle OCR regex on pixels).
 */

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
};

export interface BankMessageParser {
  readonly institutionId: string;
  canParse(input: BankMessageParseInput): boolean;
  parse(input: BankMessageParseInput): ParsedBankMessage[];
}

/**
 * Parses English Bangkok Bank SMS-style text when available as plain text.
 * Not an OCR engine — expects text already extracted.
 */
export class BangkokBankSmsParser implements BankMessageParser {
  readonly institutionId = "bangkok_bank";

  canParse(input: BankMessageParseInput): boolean {
    const t = input.text.toLowerCase();
    return (
      input.institution.toLowerCase().includes("bangkok") ||
      t.includes("available balance is bt") ||
      t.includes("from your account") ||
      t.includes("to your account") ||
      t.includes("promptpay") ||
      t.includes("bangkokbank")
    );
  }

  parse(input: BankMessageParseInput): ParsedBankMessage[] {
    const results: ParsedBankMessage[] = [];
    // Split on SMS bubbles / known Bangkok Bank openings.
    const chunks = input.text
      .split(
        /\n{2,}|(?=Withdrawal\/transfer\/payment)|(?=PromptPay)|(?=Successful)|(?=Deposit)/i,
      )
      .map((c) => c.trim())
      .filter(Boolean);

    for (const chunk of chunks) {
      const amountMatch = chunk.match(
        /(?:of\s+Bt|Bt)\s*([\d,]+(?:\.\d{2})?)/i,
      );
      const balanceMatch = chunk.match(
        /available balance is Bt\s*([\d,]+(?:\.\d{2})?)/i,
      );
      const accountMatch = chunk.match(/account\s+([A-Z]?\d{3,})/i);

      const isCredit =
        /promptpay/i.test(chunk) ||
        /transfer to your account/i.test(chunk) ||
        /deposit|received|credited to/i.test(chunk);
      const isDebit =
        !isCredit &&
        (/withdrawal|payment from|transfer\/payment from|debit/i.test(chunk) ||
          /from your account/i.test(chunk));

      if (!amountMatch && !balanceMatch) continue;
      if (!isCredit && !isDebit) continue;

      results.push({
        institution: "Bangkok Bank",
        maskedAccount: accountMatch?.[1] ?? null,
        direction: isCredit ? "credit" : "debit",
        amountMinor: amountMatch ? majorStringToMinor(amountMatch[1]!) : null,
        currency: "THB",
        balanceAfterMinor: balanceMatch
          ? majorStringToMinor(balanceMatch[1]!)
          : null,
        channel: /via\s+MOBILE/i.test(chunk) ? "mobile" : null,
        confidence: amountMatch && balanceMatch ? 0.92 : 0.65,
        raw: chunk,
      });
    }

    return results;
  }
}

export function majorStringToMinor(value: string): number {
  // Bank source format uses Western grouping: 10,058.04
  const normalized = value.replace(/,/g, "");
  const major = Number(normalized);
  if (!Number.isFinite(major)) {
    throw new Error(`Cannot parse bank amount: ${value}`);
  }
  return Math.round(major * 100);
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
