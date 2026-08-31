import type { CurrencyCode } from "@/domain/money";

/**
 * Where the money sits. Drives which currencies a new account may use.
 * Separate from accountType (checking/savings/…) which is the bank product.
 */
export const ACCOUNT_KINDS = [
  "thai_bank",
  "cash",
  "swedish_bank",
  "revolut",
  "bunq",
  "other",
] as const;

export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export function isAccountKind(value: string): value is AccountKind {
  return (ACCOUNT_KINDS as readonly string[]).includes(value);
}

/** Swedish labels for the kind picker. */
export const ACCOUNT_KIND_LABEL_SV: Record<AccountKind, string> = {
  thai_bank: "Thai-bank",
  cash: "Kontant",
  swedish_bank: "Svensk bank",
  revolut: "Revolut",
  bunq: "Bunq",
  other: "Annat",
};

/**
 * Currencies allowed when creating an account of this kind.
 * thai_bank / cash → THB only. swedish_bank → SEK only.
 * revolut / bunq / other → pick SEK, EUR or USD (one currency per account).
 */
export function currenciesForAccountKind(kind: AccountKind): CurrencyCode[] {
  switch (kind) {
    case "thai_bank":
    case "cash":
      return ["THB"];
    case "swedish_bank":
      return ["SEK"];
    case "revolut":
    case "bunq":
    case "other":
      return ["SEK", "EUR", "USD"];
  }
}

export function defaultCurrencyForKind(kind: AccountKind): CurrencyCode {
  return currenciesForAccountKind(kind)[0]!;
}

export function assertCurrencyAllowedForKind(
  kind: AccountKind,
  currency: CurrencyCode,
): void {
  const allowed = currenciesForAccountKind(kind);
  if (!allowed.includes(currency)) {
    throw new Error(
      `${currency} går inte på ${ACCOUNT_KIND_LABEL_SV[kind]}. Tillåtna: ${allowed.join(", ")}.`,
    );
  }
}

/** Suggested display name when the user picks a kind. */
export function defaultNameForKind(kind: AccountKind): string {
  return ACCOUNT_KIND_LABEL_SV[kind];
}
