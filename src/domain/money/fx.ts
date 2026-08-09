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
