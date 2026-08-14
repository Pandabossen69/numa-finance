/**
 * Shared OCR amount helpers — Bangkok Bank SMS uses western thousands
 * (10,758.04); European bank apps use comma decimals (6,60).
 */

/**
 * Fix OCR digit confusions only inside number-like tokens.
 * Never rewrite letters in words (of/from/MOBILE must stay intact).
 */
export function sanitizeOcrDigitNoise(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(
      /(?<=(?:^|[^\p{L}]))[Oo](?=[\d.,])|(?<=[\d.,])[Oo](?=[\d.,])|(?<=[\d.,])[Oo](?=$|[^\p{L}])/gu,
      "0",
    )
    .replace(/(?<=\d)[lI](?=\d)/g, "1")
    .replace(/(?<=\d)[lI](?=\.)/g, "1")
    .trim();
}

/**
 * Bangkok Bank / English SMS: "10,758.04" or "750.00".
 * Comma = thousands, period = decimal.
 */
export function westernAmountToMinor(value: string): number {
  const cleaned = sanitizeOcrDigitNoise(value)
    .replace(/\s/g, "")
    .replace(/,/g, "");
  const major = Number(cleaned);
  if (!Number.isFinite(major) || major < 0) {
    throw new Error(`Cannot parse western bank amount: ${value}`);
  }
  return Math.round(major * 100);
}

/**
 * Swedish / EU bank UI: "6,60" or "1.234,56" or "248.00".
 * Prefers last separator as decimal when ambiguous.
 */
export function europeanAmountToMinor(value: string): number {
  const cleaned = sanitizeOcrDigitNoise(value).replace(/\s/g, "");
  if (!cleaned) throw new Error(`Cannot parse European amount: ${value}`);

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    // Both present: the later one is decimal (EU: 1.234,56 / US OCR mix).
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    const decimals = cleaned.length - lastComma - 1;
    // "6,60" or "6,6" → decimal; "1,234" with 3 digits often thousands — but
    // EU money usually has 2 decimal places on screenshots.
    if (decimals === 3 && cleaned.replace(/[^\d]/g, "").length > 4) {
      normalized = cleaned.replace(",", "");
    } else {
      normalized = cleaned.replace(",", ".");
    }
  } else {
    normalized = cleaned;
  }

  const major = Number(normalized);
  if (!Number.isFinite(major) || major < 0) {
    throw new Error(`Cannot parse European amount: ${value}`);
  }
  return Math.round(major * 100);
}

export function tryWesternAmountToMinor(value: string): number | null {
  try {
    return westernAmountToMinor(value);
  } catch {
    return null;
  }
}

export function tryEuropeanAmountToMinor(value: string): number | null {
  try {
    return europeanAmountToMinor(value);
  } catch {
    return null;
  }
}

/** Major number/string from vision JSON → minor, western-style. */
export function visionMajorToMinor(
  value: number | string | null | undefined,
): number | null {
  if (value == null) return null;
  const raw = typeof value === "number" ? String(value) : String(value);
  return tryWesternAmountToMinor(raw);
}
