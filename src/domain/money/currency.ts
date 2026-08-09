export const CURRENCIES = ["THB", "SEK"] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

export const CURRENCY_META: Record<
  CurrencyCode,
  {
    code: CurrencyCode;
    /** ISO 4217 minor-unit exponent (THB/SEK = 2). */
    minorUnits: 2;
    symbol: string;
    /** Swedish-facing short label without the amount. */
    displayNameSv: string;
  }
> = {
  THB: {
    code: "THB",
    minorUnits: 2,
    symbol: "฿",
    displayNameSv: "thailändska baht",
  },
  SEK: {
    code: "SEK",
    minorUnits: 2,
    symbol: "kr",
    displayNameSv: "svenska kronor",
  },
};

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (CURRENCIES as readonly string[]).includes(value);
}

export function assertCurrency(value: string): CurrencyCode {
  if (!isCurrencyCode(value)) {
    throw new Error(`Unsupported currency: ${value}`);
  }
  return value;
}
