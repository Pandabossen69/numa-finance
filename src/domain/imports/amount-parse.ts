/**
 * Parse money majors from OCR / bank text into integer minor units.
 * Handles US (3,400.00), EU/SE (3 400,00 / 3400,00), and bare digits.
 * Never invents — returns null when the string is not a clear amount.
 */
export function majorToMinor(
  value: number | string | null | undefined,
): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.round(value * 100);
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // Keep digits, separators, and optional leading currency noise stripping.
  let cleaned = raw
    .replace(/[฿€£$]/gu, "")
    .replace(/^(?:bt|thb|sek|kr)\s*/i, "")
    .replace(/\s*(?:bt|thb|sek|kr)$/i, "")
    .trim();

  // Prefer digit+separator core (ignore trailing labels).
  const core = cleaned.match(/-?\d[\d\s.,]*/);
  if (!core) return null;
  cleaned = core[0]!.replace(/\s/g, "");

  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === ",") {
    return null;
  }

  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");

  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    // Both present: the later separator is the decimal.
    if (lastComma > lastDot) {
      // 3.400,00 → 3400.00
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      // 3,400.00 → 3400.00
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    const frac = cleaned.length - lastComma - 1;
    if (frac === 3 && cleaned.indexOf(",") === lastComma) {
      // Single comma with 3 digits → thousands: 3,400
      normalized = cleaned.replace(/,/g, "");
    } else {
      // Decimal comma: 3400,00 or 3 400,50 (spaces already stripped)
      normalized = cleaned.replace(",", ".");
    }
  } else if (lastDot >= 0) {
    const frac = cleaned.length - lastDot - 1;
    const dotCount = (cleaned.match(/\./g) ?? []).length;
    if (dotCount > 1) {
      // 3.400.000 → thousands separators
      normalized = cleaned.replace(/\./g, "");
    } else if (frac === 3 && !cleaned.includes(",")) {
      // Ambiguous 3.400 — treat as thousands (common THB SMS style without cents)
      // BUT 12.50 has frac 2. 100.000 has frac 3 with one dot → thousands.
      // Receipt totals almost always have 2 decimal places when using dot.
      normalized = cleaned.replace(/\./g, "");
    } else {
      normalized = cleaned;
    }
  } else {
    normalized = cleaned;
  }

  // Guard: only one decimal point allowed after normalize.
  if ((normalized.match(/\./g) ?? []).length > 1) return null;

  const major = Number(normalized);
  if (!Number.isFinite(major) || major < 0) return null;
  return Math.round(major * 100);
}

/** Swedish UI helper: minor → "1234,56" for editable inputs. */
export function minorToUiAmount(minor: number): string {
  return (minor / 100).toFixed(2).replace(".", ",");
}

/**
 * Confidence thresholds for UX warnings.
 * Below LOW → ask for a clearer photo (hard for SMS, soft for receipts).
 */
export const OCR_CONFIDENCE = {
  LOW: 0.55,
  MEDIUM: 0.75,
} as const;

export function ocrQualityMessage(input: {
  confidence: number | null;
  hasAmount: boolean;
  kind: "bank_sms" | "receipt";
}): { level: "ok" | "warn" | "fail"; messageSv: string } {
  if (!input.hasAmount) {
    return {
      level: "fail",
      messageSv:
        input.kind === "bank_sms"
          ? "Kunde inte läsa belopp och saldo tydligt. Ta en skarpare skärmdump av hela SMS-bubblorna."
          : "Kunde inte läsa beloppet på bilden. Ta en skarpare bild av totalsumman, eller skriv in beloppet.",
    };
  }

  const c = input.confidence;
  if (c == null) {
    return {
      level: "warn",
      messageSv:
        input.kind === "bank_sms"
          ? "Beloppet är inläst — dubbelkolla att det stämmer innan du sparar."
          : "Beloppet är inläst — kontrollera att det är exakt samma som på kvittot.",
    };
  }

  if (c < OCR_CONFIDENCE.LOW) {
    return {
      level: "fail",
      messageSv:
        "Bilden är för otydlig för säker inläsning. Ta en ny, skarp bild där siffrorna syns tydligt.",
    };
  }

  if (c < OCR_CONFIDENCE.MEDIUM) {
    return {
      level: "warn",
      messageSv:
        "Osäker läsning — siffrorna kan vara fel. Kontrollera beloppet noga innan du sparar.",
    };
  }

  return {
    level: "ok",
    messageSv:
      input.kind === "bank_sms"
        ? "Bank-SMS inläst. Kontrollera listan och spara."
        : "Belopp inläst från bilden. Dubbelkolla och spara.",
  };
}
