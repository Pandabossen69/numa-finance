/**
 * OCR FX lines from bank apps, e.g. bunq ZeroFX:
 *   "248.00 THB, 1 THB = 0.02661 EUR"
 *   "1 EUR = 37.58 THB"
 *
 * Never invent rates — only parse explicit quotes.
 */

import {
  parseCurrencyToken,
  type CurrencyCode,
} from "@/domain/money/currency";
import type { FxRate } from "@/domain/money/fx";
import { tryEuropeanAmountToMinor } from "@/domain/imports/ocr-amounts";

export type ParsedOcrFxQuote = {
  /** base → quote: how many quote major units per 1 base major unit */
  rate: FxRate;
  /** Optional merchant original amount spotted next to the quote. */
  originalAmountMinor: number | null;
  originalCurrency: CurrencyCode | null;
};

const PAIR_RE =
  /1\s*([A-Z]{2,3}|€|฿|TH|BT|KR)\s*=\s*([\d.,]+)\s*([A-Z]{2,3}|€|฿|TH|BT|KR)/gi;

const ORIG_RE =
  /([\d.,]+)\s*(THB|BT|TH|SEK|KR|EUR|€)\b/gi;

/**
 * Invert a quote so convertWithRate(amount in from, to) works.
 * FxRate: baseCurrency amount × rate = quoteCurrency amount.
 */
export function fxRateFromPair(input: {
  leftCurrency: CurrencyCode;
  rightCurrency: CurrencyCode;
  /** right major per 1 left major */
  rightPerLeft: number;
  asOf: string;
  source: string;
}): FxRate {
  return {
    baseCurrency: input.leftCurrency,
    quoteCurrency: input.rightCurrency,
    rate: input.rightPerLeft,
    asOf: input.asOf,
    source: input.source,
  };
}

export function invertFxRate(rate: FxRate, source = `${rate.source}:invert`): FxRate {
  if (!(rate.rate > 0)) {
    throw new Error("Cannot invert non-positive FX rate");
  }
  return {
    baseCurrency: rate.quoteCurrency,
    quoteCurrency: rate.baseCurrency,
    rate: 1 / rate.rate,
    asOf: rate.asOf,
    source,
  };
}

/**
 * Build an FxRate that converts `from` → `to` if either direction was quoted.
 */
export function fxRateForConversion(
  quote: FxRate,
  from: CurrencyCode,
  to: CurrencyCode,
): FxRate | null {
  if (from === quote.baseCurrency && to === quote.quoteCurrency) return quote;
  if (from === quote.quoteCurrency && to === quote.baseCurrency) {
    return invertFxRate(quote);
  }
  return null;
}

export function parseOcrFxQuotes(
  text: string,
  options?: { asOf?: string; source?: string },
): ParsedOcrFxQuote[] {
  const asOf = options?.asOf ?? new Date().toISOString();
  const source = options?.source ?? "bank_app_ocr";
  const out: ParsedOcrFxQuote[] = [];

  for (const m of text.matchAll(PAIR_RE)) {
    const left = parseCurrencyToken(m[1]);
    const right = parseCurrencyToken(m[3]);
    const rightPerLeft = Number(
      String(m[2]).replace(/\s/g, "").replace(",", "."),
    );
    if (!left || !right || left === right) continue;
    if (!Number.isFinite(rightPerLeft) || rightPerLeft <= 0) continue;

    // Prefer an original amount in the same sentence / nearby with non-quote currency.
    let originalAmountMinor: number | null = null;
    let originalCurrency: CurrencyCode | null = null;
    const windowStart = Math.max(0, (m.index ?? 0) - 40);
    const window = text.slice(windowStart, (m.index ?? 0) + m[0].length + 10);
    for (const o of window.matchAll(ORIG_RE)) {
      const cur = parseCurrencyToken(o[2]);
      const minor = tryEuropeanAmountToMinor(o[1]!);
      if (!cur || minor == null) continue;
      // Skip the "1 THB" left side of the rate pair.
      if (o[1] === "1" || o[1] === "1,0" || o[1] === "1.0") continue;
      if (cur === left && Math.abs(minor - 100) < 1) continue;
      originalAmountMinor = minor;
      originalCurrency = cur;
      break;
    }

    out.push({
      rate: fxRateFromPair({
        leftCurrency: left,
        rightCurrency: right,
        rightPerLeft,
        asOf,
        source,
      }),
      originalAmountMinor,
      originalCurrency,
    });
  }

  return out;
}

/** First usable quote that can convert from → to. */
export function findOcrFxRate(
  text: string,
  from: CurrencyCode,
  to: CurrencyCode,
  options?: { asOf?: string; source?: string },
): FxRate | null {
  for (const q of parseOcrFxQuotes(text, options)) {
    const usable = fxRateForConversion(q.rate, from, to);
    if (usable) return usable;
  }
  return null;
}
