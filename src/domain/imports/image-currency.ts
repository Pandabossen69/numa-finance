import {
  parseCurrencyToken,
  type CurrencyCode,
} from "@/domain/money/currency";

function provedCurrencies(text: string): Set<CurrencyCode> {
  const found = new Set<CurrencyCode>();
  if (/฿|บาท|\bbaht\b|\bthb\b|\bbt\b/iu.test(text)) found.add("THB");
  if (/€|\beur\b|\beuro\b/iu.test(text)) found.add("EUR");
  if (/\bsek\b|\bkr\b|\bkronor\b/iu.test(text)) found.add("SEK");
  if (/\busd\b|\bus\$\b/iu.test(text)) found.add("USD");
  return found;
}

/**
 * Currency printed on the image.
 * THB / ฿ / บาท wins over a model EUR when the image does not also show euro.
 * Returns null when nothing on the image (or the model) names a currency.
 */
export function resolveImageCurrency(input: {
  explicit?: string | null;
  texts?: Array<string | null | undefined>;
}): CurrencyCode | null {
  const blob = (input.texts ?? [])
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join("\n");
  const proved = provedCurrencies(blob);
  const explicit = parseCurrencyToken(input.explicit ?? null);

  if (proved.has("THB") && !proved.has("EUR") && !proved.has("SEK") && !proved.has("USD")) {
    return "THB";
  }
  if (proved.has("SEK") && !proved.has("EUR")) return "SEK";
  if (proved.has("USD") && !proved.has("EUR") && !proved.has("THB")) return "USD";
  if (proved.has("EUR") && proved.size === 1) return "EUR";
  if (proved.has("EUR") && proved.has("THB")) {
    if (explicit === "THB" || explicit === "SEK" || explicit === "USD") return explicit;
    return "EUR";
  }
  if (explicit && (proved.size === 0 || proved.has(explicit))) return explicit;
  if (proved.size === 1) return [...proved][0]!;
  return explicit;
}
