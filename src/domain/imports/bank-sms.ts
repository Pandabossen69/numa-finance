import {
  buildTransactionFingerprint,
  matchFingerprint,
  type TransactionDirection,
} from "@/domain/finance";
import {
  defaultBankParserRegistry,
  type ParsedBankMessage,
} from "./bank-parsers";

export type BankSmsCandidate = {
  id: string;
  direction: TransactionDirection;
  amountMinor: number;
  currency: "THB" | "SEK";
  balanceAfterMinor: number | null;
  maskedAccount: string | null;
  channel: string | null;
  description: string;
  fingerprint: string;
  fingerprintConfidence: "high" | "medium" | "low";
  confidence: number;
  raw: string;
  /** Already in the ledger (same fingerprint). */
  duplicate: boolean;
};

/**
 * Split OCR / pasted SMS dump into Bangkok Bank message candidates
 * with fingerprints that include balance-after (so no-date SMS still dedupe).
 */
export function buildBankSmsCandidates(input: {
  text: string;
  institutionHint?: string | null;
  existingFingerprints: Iterable<string>;
}): BankSmsCandidate[] {
  const text = input.text.trim();
  if (!text) return [];

  const institution = input.institutionHint?.trim() || "Bangkok Bank";
  const parsed = defaultBankParserRegistry.parse({ institution, text });
  const existing = [...input.existingFingerprints];

  return parsed
    .map((msg, index) => toCandidate(msg, index, existing))
    .filter((c): c is BankSmsCandidate => c != null);
}

function toCandidate(
  msg: ParsedBankMessage,
  index: number,
  existing: string[],
): BankSmsCandidate | null {
  if (msg.amountMinor == null || msg.amountMinor <= 0) return null;
  if (!msg.direction) return null;
  if (!msg.currency) return null;

  const account = msg.maskedAccount ?? "unknown";
  const fp = buildTransactionFingerprint({
    institution: msg.institution,
    maskedAccount: account,
    direction: msg.direction,
    amountMinor: msg.amountMinor,
    balanceAfterMinor: msg.balanceAfterMinor,
    channel: msg.channel,
  });

  const dup = matchFingerprint(fp.fingerprint, existing);
  const description =
    msg.direction === "credit"
      ? "Insättning (bank-SMS)"
      : "Köp / uttag (bank-SMS)";

  return {
    id: `sms-${index}-${fp.fingerprint.slice(0, 24)}`,
    direction: msg.direction,
    amountMinor: msg.amountMinor,
    currency: msg.currency,
    balanceAfterMinor: msg.balanceAfterMinor,
    maskedAccount: msg.maskedAccount,
    channel: msg.channel,
    description,
    fingerprint: fp.fingerprint,
    fingerprintConfidence: fp.confidence,
    confidence: msg.confidence,
    raw: msg.raw,
    duplicate: dup.kind === "exact",
  };
}

/**
 * Newest balance in a screenshot: prefer the last message that has
 * balance-after (Messages usually shows newest at the bottom).
 */
export function latestBalanceAfterMinor(
  candidates: Array<Pick<BankSmsCandidate, "balanceAfterMinor">>,
): number | null {
  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const bal = candidates[i]?.balanceAfterMinor;
    if (bal != null) return bal;
  }
  return null;
}
