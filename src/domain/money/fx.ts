import type { CurrencyCode } from "./currency";
import { money, type Money } from "./money";

/**
 * Explicit FX quote. Never invent a live rate in Phase 0.
 * Historical conversions must retain the rate used at conversion time.
 */
export type FxRate = {
  readonly baseCurrency: CurrencyCode;
  readonly quoteCurrency: CurrencyCode;
  /** How many quote minor-units per 1 base major-unit? Prefer rate as rational-friendly number. */
  readonly rate: number;
  readonly asOf: string;
  readonly source: string;
};

export type FxConversionRecord = {
  readonly original: Money;
  readonly referenceCurrency: CurrencyCode;
  readonly rate: number;
  readonly converted: Money;
  readonly asOf: string;
  readonly source: string;
};

export interface FxProvider {
  getRate(
    base: CurrencyCode,
    quote: CurrencyCode,
    asOf?: Date,
  ): Promise<FxRate | null>;
}

/**
 * Static provider for Phase 0 — no live API.
 * Returns null unless a rate was explicitly registered.
 */
export class StaticFxProvider implements FxProvider {
  private readonly rates = new Map<string, FxRate>();

  setRate(rate: FxRate): void {
    this.rates.set(key(rate.baseCurrency, rate.quoteCurrency), rate);
  }

  async getRate(
    base: CurrencyCode,
    quote: CurrencyCode,
  ): Promise<FxRate | null> {
    if (base === quote) {
      return {
        baseCurrency: base,
        quoteCurrency: quote,
        rate: 1,
        asOf: new Date().toISOString(),
        source: "identity",
      };
    }
    return this.rates.get(key(base, quote)) ?? null;
  }
}

export function convertWithRate(
  amount: Money,
  targetCurrency: CurrencyCode,
  rate: FxRate,
): FxConversionRecord {
  if (amount.currency !== rate.baseCurrency) {
    throw new Error("FX rate base currency does not match amount currency");
  }
  if (targetCurrency !== rate.quoteCurrency) {
    throw new Error("FX rate quote currency does not match target currency");
  }

  // Convert via major units with explicit rate, then round to nearest minor unit.
  const major = amount.amountMinor / 100;
  const convertedMajor = major * rate.rate;
  const converted = money(Math.round(convertedMajor * 100), targetCurrency);

  return {
    original: amount,
    referenceCurrency: targetCurrency,
    rate: rate.rate,
    converted,
    asOf: rate.asOf,
    source: rate.source,
  };
}

function key(base: CurrencyCode, quote: CurrencyCode): string {
  return `${base}:${quote}`;
}

export type FxQuoteToThb = {
  /** THB per 1 major unit of `from`. */
  rate: number;
  asOf: string;
  source: "manual" | "frankfurter" | "identity";
};

const FRANKFURTER_URL = "https://api.frankfurter.app/latest";

/**
 * Mid-market rate: 1 `from` (major) = `rate` THB (major).
 * Frankfurter (ECB). Returns null on network/API failure — caller must
 * fall back to a manual rate rather than invent one.
 */
export async function fetchFxToThb(
  from: CurrencyCode,
): Promise<FxQuoteToThb | null> {
  if (from === "THB") {
    return {
      rate: 1,
      asOf: new Date().toISOString(),
      source: "identity",
    };
  }

  try {
    const url = `${FRANKFURTER_URL}?from=${from}&to=THB`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      date?: string;
      rates?: { THB?: number };
    };
    const rate = data.rates?.THB;
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      return null;
    }
    const asOf = data.date
      ? new Date(`${data.date}T12:00:00.000Z`).toISOString()
      : new Date().toISOString();
    return { rate, asOf, source: "frankfurter" };
  } catch {
    return null;
  }
}

/** Native minor → THB minor using a major→major rate. */
export function thbMinorFromNative(
  balanceMinor: number,
  currency: CurrencyCode,
  rate: number,
): number {
  if (currency === "THB") return balanceMinor;
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return Math.round(balanceMinor * rate);
}

export function parseManualRate(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
