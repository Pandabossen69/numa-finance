/** Categories the capture chip can actually select. */
export const CAPTURE_CATEGORIES = [
  "Mat",
  "Transport",
  "Shopping",
  "Boende",
  "Övrigt",
] as const;

export type CaptureCategory = (typeof CAPTURE_CATEGORIES)[number];

/**
 * Hints bank-app OCR and Revolut labels actually send.
 * Resor is not a NUMA category, so travel hints land on Transport.
 * Anything not in this table is unknown — the chip must not guess Mat.
 */
export const KNOWN_CATEGORY_HINTS: ReadonlyArray<
  readonly [hint: string, category: CaptureCategory]
> = [
  ["Mat", "Mat"],
  ["Restaurant", "Mat"],
  ["Restaurants", "Mat"],
  ["Restaurang", "Mat"],
  ["Restauranger", "Mat"],
  ["Grocery", "Mat"],
  ["Groceries", "Mat"],
  ["Livsmedel", "Mat"],
  ["Matvaror", "Mat"],
  ["Transport", "Transport"],
  ["Taxi", "Transport"],
  ["Grab", "Transport"],
  ["Bolt", "Transport"],
  ["Uber", "Transport"],
  ["Fuel", "Transport"],
  ["Bensin", "Transport"],
  ["Resor", "Transport"],
  ["Resa", "Transport"],
  ["Travel", "Transport"],
  ["Flyg", "Transport"],
  ["Flight", "Transport"],
  ["Shopping", "Shopping"],
  ["Retail", "Shopping"],
  ["Webshop", "Shopping"],
  ["Boende", "Boende"],
  ["Rent", "Boende"],
  ["Hyra", "Boende"],
  ["Utilities", "Boende"],
  ["Hotell", "Boende"],
  ["Övrigt", "Övrigt"],
  ["Other", "Övrigt"],
  ["Entertainment", "Övrigt"],
  ["Nöje", "Övrigt"],
  ["Health", "Övrigt"],
  ["Hälsa", "Övrigt"],
  ["Services", "Övrigt"],
  ["Tjänster", "Övrigt"],
  ["General", "Övrigt"],
];

const HINT_TO_CATEGORY = new Map<string, CaptureCategory>(
  KNOWN_CATEGORY_HINTS.map(([hint, category]) => [hint.toLowerCase(), category]),
);

const TRAVEL_HINTS = new Set([
  "resor",
  "resa",
  "travel",
  "travels",
  "trip",
  "trips",
  "flyg",
  "flight",
  "flights",
]);

function travelCategory(): CaptureCategory {
  const list = CAPTURE_CATEGORIES as readonly string[];
  // Resor is not in the chip list today. If it is added, use it.
  if (list.includes("Resor")) return "Resor" as CaptureCategory;
  return "Transport";
}

/**
 * Trust an AI / screenshot category only when it is a known label or alias.
 * Anything else (unknown words, empty, non-strings) is ignored.
 */
export function resolveCategoryFromHint(
  hint: string | null | undefined,
): CaptureCategory | null {
  if (typeof hint !== "string") return null;
  const normalized = hint.trim().toLowerCase();
  if (!normalized) return null;
  if (TRAVEL_HINTS.has(normalized)) return travelCategory();
  const exact = CAPTURE_CATEGORIES.find((c) => c.toLowerCase() === normalized);
  if (exact) return exact;
  return HINT_TO_CATEGORY.get(normalized) ?? null;
}

/**
 * First debit hint.
 * No hint at all stays on Mat (the chip default when OCR omits one).
 * A hint we don't know becomes Övrigt — never Mat.
 */
export function categoryFromEvents(
  events: Array<{ direction: string; categoryHint?: string | null }> | undefined,
): string {
  const raw = events?.find((event) => event.direction === "debit")?.categoryHint;
  if (raw == null || (typeof raw === "string" && raw.trim() === "")) return "Mat";
  return resolveCategoryFromHint(raw) ?? "Övrigt";
}
