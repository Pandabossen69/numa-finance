import { majorToMinor } from "./amount-parse";

/**
 * Priority for receipt “what did I actually pay?” labels.
 * Higher wins. Delivery apps (Grab) put Final total after adjustments.
 */
const TOTAL_LABELS: Array<{ re: RegExp; priority: number; key: string }> = [
  { re: /\bfinal\s*total\b/i, priority: 100, key: "final_total" },
  { re: /\bamount\s*paid\b/i, priority: 95, key: "amount_paid" },
  { re: /\btotal\s*paid\b/i, priority: 95, key: "total_paid" },
  { re: /\byou\s*paid\b/i, priority: 95, key: "you_paid" },
  { re: /\bgrand\s*total\b/i, priority: 90, key: "grand_total" },
  { re: /\btotal\s*due\b/i, priority: 90, key: "total_due" },
  { re: /\btotal\s*amount\b/i, priority: 85, key: "total_amount" },
  { re: /\bbelopp\s*att\s*betala\b/i, priority: 95, key: "belopp_att_betala" },
  { re: /\batt\s*betala\b/i, priority: 90, key: "att_betala" },
  { re: /\bbetalningssumma\b/i, priority: 90, key: "betalningssumma" },
  { re: /\btotalt\s*att\s*betala\b/i, priority: 95, key: "totalt_att_betala" },
  { re: /\bsumma\s*att\s*betala\b/i, priority: 95, key: "summa_att_betala" },
  { re: /\btotalt\b/i, priority: 70, key: "totalt" },
  { re: /\bsumma\b/i, priority: 65, key: "summa" },
  // Plain "Total" last among labels — often a subtotal before discounts.
  { re: /\btotal\b/i, priority: 60, key: "total" },
];

/** Lines that look like adjustments / tips / change — never the paid total. */
const REJECT_LINE =
  /\b(adjustment|discount|promo|tip|change|refund|subtotal|vat|tax|moms|rabatt|justering|service\s*fee|delivery\s*fee)\b/i;

const AMOUNT_TOKEN =
  /(?:฿|bt|thb|sek|kr|€|£|\$)?\s*-?\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?/gi;

export type PaidTotalHit = {
  amountMinor: number;
  labelKey: string;
  priority: number;
  /** Raw amount string as found near the label. */
  amountText: string;
};

function firstAmountOnLine(line: string): { text: string; minor: number } | null {
  const matches = line.match(AMOUNT_TOKEN);
  if (!matches) return null;
  // Prefer the rightmost amount on the line (labels left, money right).
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const text = matches[i]!.trim();
    if (!text || text.startsWith("-")) continue;
    const minor = majorToMinor(text);
    if (minor != null && minor > 0) return { text, minor };
  }
  return null;
}

/**
 * Find the amount the customer actually paid from OCR / vision fullText.
 * Prefers Grab-style "Final total" over earlier order totals and adjustments.
 */
export function extractPaidTotalFromText(
  text: string | null | undefined,
): PaidTotalHit | null {
  if (!text || !text.trim()) return null;

  const lines = text
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let best: PaidTotalHit | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (REJECT_LINE.test(line) && !/\bfinal\s*total\b/i.test(line)) {
      continue;
    }

    for (const label of TOTAL_LABELS) {
      if (!label.re.test(line)) continue;

      const same = firstAmountOnLine(line);
      const next =
        !same && i + 1 < lines.length ? firstAmountOnLine(lines[i + 1]!) : null;
      const hit = same ?? next;
      if (!hit) continue;

      const candidate: PaidTotalHit = {
        amountMinor: hit.minor,
        labelKey: label.key,
        priority: label.priority,
        amountText: hit.text,
      };

      // Higher priority wins; same priority → later on the receipt (usually bottom).
      if (
        !best ||
        candidate.priority > best.priority ||
        (candidate.priority === best.priority && i >= 0)
      ) {
        // Always allow later equal-priority to overwrite (bottom-of-receipt bias).
        if (!best || candidate.priority > best.priority) {
          best = candidate;
        } else if (candidate.priority === best.priority) {
          best = candidate;
        }
      }
    }
  }

  return best;
}

/**
 * Resolve receipt paid total: labeled text wins over a raw vision amount
 * when they disagree (classic Grab: 875 vs Final total 749).
 */
export function resolveReceiptPaidAmountMinor(input: {
  visionAmountMinor: number | null | undefined;
  fullText?: string | null;
}): number | null {
  const fromText = extractPaidTotalFromText(input.fullText);
  const vision =
    input.visionAmountMinor != null && input.visionAmountMinor > 0
      ? input.visionAmountMinor
      : null;

  if (fromText && vision != null && fromText.amountMinor !== vision) {
    // Strong labels always override a mismatched vision guess.
    if (fromText.priority >= 85) return fromText.amountMinor;
  }
  if (fromText) return fromText.amountMinor;
  return vision;
}
