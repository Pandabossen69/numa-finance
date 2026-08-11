import type { TransactionDirection } from "./types";

/**
 * Deterministic fingerprint for Bangkok Bank SMS (no payment date in the bubble).
 *
 * Uniqueness = institution + account + direction + amount + available balance.
 * Two screenshots of the same SMS always produce the same fingerprint, so we
 * never import it twice — even when the thread also contains newer SMS.
 * Never use amount alone (50 Bt can happen many times).
 */
export type FingerprintParts = {
  institution: string;
  maskedAccount: string;
  direction: TransactionDirection;
  amountMinor: number;
  balanceAfterMinor: number | null;
  occurredAt?: string | null;
  channel?: string | null;
};

export type FingerprintResult = {
  fingerprint: string;
  confidence: "high" | "medium" | "low";
  strategy: string;
};

export function normalizeInstitution(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export function normalizeMaskedAccount(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(-4);
  return value.trim().toUpperCase();
}

export function buildTransactionFingerprint(
  parts: FingerprintParts,
): FingerprintResult {
  const institution = normalizeInstitution(parts.institution);
  const account = normalizeMaskedAccount(parts.maskedAccount);
  const channel = (parts.channel ?? "unknown").trim().toLowerCase();

  if (parts.balanceAfterMinor != null) {
    // Channel omitted on purpose: MOBILE vs ATM OCR noise must not create dupes.
    const fingerprint = [
      institution,
      account,
      parts.direction,
      String(parts.amountMinor),
      `balanceAfter=${parts.balanceAfterMinor}`,
    ].join("|");

    return {
      fingerprint,
      confidence: "high",
      strategy: "institution+account+direction+amount+balanceAfter",
    };
  }

  if (parts.occurredAt) {
    const fingerprint = [
      institution,
      account,
      parts.direction,
      String(parts.amountMinor),
      `at=${parts.occurredAt}`,
      channel,
    ].join("|");

    return {
      fingerprint,
      confidence: "medium",
      strategy: "institution+account+direction+amount+occurredAt+channel",
    };
  }

  const fingerprint = [
    institution,
    account,
    parts.direction,
    String(parts.amountMinor),
    channel,
  ].join("|");

  return {
    fingerprint,
    confidence: "low",
    strategy: "institution+account+direction+amount+channel",
  };
}

export type DuplicateMatch =
  | { kind: "exact"; fingerprint: string }
  | { kind: "ambiguous"; reason: string }
  | { kind: "none" };

export function matchFingerprint(
  candidate: string,
  existing: Iterable<string>,
): DuplicateMatch {
  for (const fp of existing) {
    if (fp === candidate) {
      return { kind: "exact", fingerprint: fp };
    }
  }
  return { kind: "none" };
}

/**
 * When balance-after is missing, same amount+direction+account is ambiguous.
 */
export function assessAmountOnlyAmbiguity(params: {
  amountMinor: number;
  direction: TransactionDirection;
  existingSameAmountCount: number;
}): DuplicateMatch {
  if (params.existingSameAmountCount > 0) {
    return {
      kind: "ambiguous",
      reason:
        "Multiple transactions share amount and direction without balance-after context",
    };
  }
  return { kind: "none" };
}
