import type { TransactionDirection } from "./types";

/**
 * Deterministic fingerprint for Bangkok Bank SMS (no payment date in the bubble).
 *
 * Uniqueness = institution + account + direction + amount + available balance.
 * Two screenshots of the same SMS always produce the same fingerprint, so we
 * never import it twice — even when the thread also contains newer SMS.
 * Never use amount alone (50 Bt can happen many times).
 *
 * Bank-app screenshots (bunq / Revolut) use merchant + occurredAt instead of
 * balance-after — see buildBankAppFingerprint.
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

export type BankAppFingerprintParts = {
  institution: string;
  merchant: string;
  direction: TransactionDirection;
  amountMinor: number;
  currency: string;
  /** ISO-ish local stamp, e.g. 2026-07-23T16:46 — minute precision is enough. */
  occurredAt: string;
  originalAmountMinor?: number | null;
  originalCurrency?: string | null;
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

export function normalizeMerchantKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.(com|co|th|se|net|app)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 48);
}

/** Truncate to minute so OCR second-noise cannot create dupes. */
export function normalizeOccurredAtMinute(value: string): string {
  const trimmed = value.trim();
  const m = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})[T\s](\d{2}):(\d{2})(?::\d{2})?/,
  );
  if (m) return `${m[1]}T${m[2]}:${m[3]}`;
  return trimmed.slice(0, 16);
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
      `at=${normalizeOccurredAtMinute(parts.occurredAt)}`,
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

/**
 * bunq / Revolut / similar: no available-balance in the UI row.
 * Prefer original (THB) amount in the key when present so EUR↔THB FX
 * display cannot create a second identity for the same purchase.
 */
export function buildBankAppFingerprint(
  parts: BankAppFingerprintParts,
): FingerprintResult {
  const institution = normalizeInstitution(parts.institution);
  const merchant = normalizeMerchantKey(parts.merchant) || "unknown";
  const at = normalizeOccurredAtMinute(parts.occurredAt);
  const amountKey =
    parts.originalAmountMinor != null && parts.originalCurrency
      ? `${parts.originalAmountMinor}:${parts.originalCurrency.toUpperCase()}`
      : `${parts.amountMinor}:${parts.currency.toUpperCase()}`;

  const fingerprint = [
    "bankapp",
    institution,
    merchant,
    parts.direction,
    amountKey,
    `at=${at}`,
  ].join("|");

  return {
    fingerprint,
    confidence: parts.originalAmountMinor != null ? "high" : "medium",
    strategy: "bankapp+institution+merchant+direction+amount+occurredAt",
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
