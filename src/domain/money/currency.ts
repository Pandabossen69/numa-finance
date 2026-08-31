export const CURRENCIES = ["THB", "SEK", "EUR", "USD"] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

export const CURRENCY_META: Record<
  CurrencyCode,
  {
    code: CurrencyCode;
    /** ISO 4217 minor-unit exponent (THB/SEK/EUR/USD = 2). */
    minorUnits: 2;
    symbol: string;
    /** Swedish-facing short label without the amount. */
    displayNameSv: string;
  }
> = {
  THB: {
    code: "THB",
    minorUnits: 2,
    /** ISO code — ฿ often looks like $ in UI monospace fonts. */
    symbol: "THB",
    displayNameSv: "thailändska baht",
  },
  SEK: {
    code: "SEK",
    minorUnits: 2,
    symbol: "kr",
    displayNameSv: "svenska kronor",
  },
  EUR: {
    code: "EUR",
    minorUnits: 2,
    symbol: "€",
    displayNameSv: "euro",
  },
  USD: {
    code: "USD",
    minorUnits: 2,
    symbol: "USD",
    displayNameSv: "amerikanska dollar",
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

/** Normalize OCR / UI currency tokens → CurrencyCode or null. */
export function parseCurrencyToken(
  value: string | null | undefined,
): CurrencyCode | null {
  if (!value) return null;
  const t = value.trim().toUpperCase().replace(/\s+/g, "");
  if (t === "EUR" || t === "€" || t === "EURO") return "EUR";
  if (t === "THB" || t === "BT" || t === "฿" || t === "TH") return "THB";
  if (t === "SEK" || t === "KR" || t === "KRONOR") return "SEK";
  if (t === "USD" || t === "$" || t === "US$" || t === "DOLLAR" || t === "DOLLARS") {
    return "USD";
  }
  return isCurrencyCode(t) ? t : null;
}
