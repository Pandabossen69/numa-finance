import { CURRENCY_META, type CurrencyCode } from "./currency";
import { toMajorUnits, type Money } from "./money";

export type FormatMoneyOptions = {
  /** Show fractional digits even when zero (default true for finance). */
  showFraction?: boolean;
  /** Force a specific locale for separators (default sv-SE). */
  locale?: string;
};

/**
 * Display formatting only. Never use this string for parsing or domain math.
 *
 * THB uses the ISO code as a suffix ("10 108,04 THB") — the ฿ glyph often
 * renders like $ in monospace UI fonts and confuses readers.
 */
export function formatMoney(
  value: Money,
  options: FormatMoneyOptions = {},
): string {
  const { showFraction = true, locale = "sv-SE" } = options;
  const meta = CURRENCY_META[value.currency];
  const major = toMajorUnits(value);

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: showFraction ? 2 : 0,
    maximumFractionDigits: showFraction ? 2 : 0,
    useGrouping: true,
  }).format(major);

  return `${formatted} ${meta.symbol}`;
}

export function formatMoneyCompact(
  value: Money,
  options: FormatMoneyOptions = {},
): string {
  const hasFraction = Math.abs(value.amountMinor) % 100 !== 0;
  return formatMoney(value, {
    ...options,
    showFraction: options.showFraction ?? hasFraction,
  });
}

/**
 * Parse a UI amount string in Swedish-ish form into minor units.
 * Accepts "750", "750,50", "10 058,04", "750.50".
 * Does NOT accept bank source strings with "Bt" prefixes — use bank parsers for those.
 */
export function parseUiAmountToMinor(input: string): number {
  const cleaned = input
    .trim()
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!cleaned || cleaned === "-" || cleaned === "," || cleaned === ".") {
    throw new Error("Ogiltigt belopp");
  }

  const negative = cleaned.startsWith("-");
  const raw = negative ? cleaned.slice(1) : cleaned;

  let normalized: string;
  if (raw.includes(",") && raw.includes(".")) {
    // Ambiguous: treat last separator as decimal.
    const lastComma = raw.lastIndexOf(",");
    const lastDot = raw.lastIndexOf(".");
    if (lastComma > lastDot) {
      normalized = raw.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = raw.replace(/,/g, "");
    }
  } else if (raw.includes(",")) {
    normalized = raw.replace(",", ".");
  } else {
    normalized = raw;
  }

  const major = Number(normalized);
  if (!Number.isFinite(major)) {
    throw new Error("Ogiltigt belopp");
  }

  const minor = Math.round(major * 100);
  return negative ? -minor : minor;
}

export function shouldShowReferenceCurrency(
  amountMinor: number,
  thresholdMinor = 500_00,
): boolean {
  return Math.abs(amountMinor) >= thresholdMinor;
}

export function formatReferenceApprox(
  primary: Money,
  reference: Money | null,
): string | null {
  if (!reference) return null;
  if (!shouldShowReferenceCurrency(primary.amountMinor)) return null;
  return `≈ ${formatMoneyCompact(reference)}`;
}

export function currencyLabel(currency: CurrencyCode): string {
  return CURRENCY_META[currency].symbol;
}

/**
 * Rewrite legacy baht glyphs in stored labels/descriptions so UI never shows ฿
 * (often renders like $ in monospace). Prefer "… THB" suffix.
 */
export function sanitizeMoneyDescription(text: string): string {
  if (!text.includes("฿")) return text;
  return text
    // End the amount on a digit so trailing spaces before "·" stay intact.
    .replace(/฿\s*([\d\s.,]*\d)/g, "$1 THB")
    .replace(/\s+THB(\s+THB)+/g, " THB")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const RAW_BANK_SMS =
  /^(withdrawal|transfer|payment|deposit|incoming|outgoing|promptpay|moneyplus)\b/i;

/** Cheap Swedish title for raw English bank-SMS stored as the movement name. */
export function humanizeMovementTitle(
  description: string,
  signedAmountMinor: number,
): string {
  const clean = sanitizeMoneyDescription(description).trim();
  if (RAW_BANK_SMS.test(clean)) {
    return signedAmountMinor < 0 ? "Utgift (bank-SMS)" : "Insättning (bank-SMS)";
  }
  return clean;
}
