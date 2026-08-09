import { assertCurrency, type CurrencyCode } from "./currency";

/**
 * Canonical monetary value using integer minor units.
 * THB 750.00 => 75000
 * SEK 100.50 => 10050
 */
export type Money = {
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
};

export class CurrencyMismatchError extends Error {
  constructor(left: CurrencyCode, right: CurrencyCode) {
    super(`Cannot operate on mixed currencies: ${left} vs ${right}`);
    this.name = "CurrencyMismatchError";
  }
}

export function money(amountMinor: number, currency: CurrencyCode): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new Error("Money amount must be an integer number of minor units");
  }
  return Object.freeze({ amountMinor, currency: assertCurrency(currency) });
}

export function fromMajorUnits(amountMajor: number, currency: CurrencyCode): Money {
  if (!Number.isFinite(amountMajor)) {
    throw new Error("Amount must be a finite number");
  }
  // Avoid float drift for typical 2-decimal currencies by rounding to nearest minor unit.
  const amountMinor = Math.round(amountMajor * 100);
  return money(amountMinor, currency);
}

export function toMajorUnits(value: Money): number {
  return value.amountMinor / 100;
}

export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new CurrencyMismatchError(a.currency, b.currency);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  if (a.amountMinor < b.amountMinor) return -1;
  if (a.amountMinor > b.amountMinor) return 1;
  return 0;
}

export function isZero(value: Money): boolean {
  return value.amountMinor === 0;
}

export function isNegative(value: Money): boolean {
  return value.amountMinor < 0;
}

export function absMoney(value: Money): Money {
  return money(Math.abs(value.amountMinor), value.currency);
}

export function minMoney(a: Money, b: Money): Money {
  return compareMoney(a, b) <= 0 ? a : b;
}

export function maxMoney(a: Money, b: Money): Money {
  return compareMoney(a, b) >= 0 ? a : b;
}

export function clampNonNegative(value: Money): Money {
  return money(Math.max(0, value.amountMinor), value.currency);
}
