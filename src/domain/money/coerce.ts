import { assertCurrency, type CurrencyCode } from "./currency";
import { money, type Money } from "./money";

/**
 * Coerce DB/JSON numeric values into safe integer minor units.
 * PostgREST may return bigint-like values as strings; never let that
 * crash the UI via money()'s integer check.
 */
export function coerceMinor(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return fallback;
}

export function moneyFromUnknown(
  amountMinor: unknown,
  currency: CurrencyCode,
  fallback = 0,
): Money {
  return money(coerceMinor(amountMinor, fallback), assertCurrency(currency));
}
