import { toMajorUnits, money, type CurrencyCode } from "@/domain/money";
import { CURRENCY_META } from "@/domain/money/currency";

/**
 * Money display: amount in tabular mono, currency code in soft sans.
 * THB shows as "10 108,04 THB" — never the ฿ glyph (reads as $ in many fonts).
 */
export function MoneyDisplay({
  amountMinor,
  currency,
  size = "md",
  compact = false,
  tone = "neutral",
}: {
  amountMinor: number;
  currency: CurrencyCode;
  size?: "sm" | "md" | "lg" | "xl";
  compact?: boolean;
  /** Color negative amounts as danger when "signed". */
  tone?: "neutral" | "signed";
}) {
  const safeMinor = Number.isInteger(amountMinor)
    ? amountMinor
    : Math.round(Number.isFinite(amountMinor) ? amountMinor : 0);
  const value = money(safeMinor, currency);
  const showFraction = compact ? Math.abs(safeMinor) % 100 !== 0 : true;
  const amountText = new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: showFraction ? 2 : 0,
    maximumFractionDigits: showFraction ? 2 : 0,
    useGrouping: true,
  }).format(toMajorUnits(value));
  const currencyText = CURRENCY_META[currency].symbol;

  const sizeClass =
    size === "xl"
      ? "text-[2.75rem] leading-none font-semibold tracking-tight"
      : size === "lg"
        ? "text-3xl font-semibold tracking-tight"
        : size === "md"
          ? "text-xl font-semibold"
          : "text-base font-medium";

  const codeSize =
    size === "xl"
      ? "text-[1.05rem] font-semibold tracking-[0.04em]"
      : size === "lg"
        ? "text-sm font-semibold tracking-[0.04em]"
        : size === "md"
          ? "text-xs font-semibold tracking-[0.06em]"
          : "text-[0.65rem] font-semibold tracking-[0.06em]";

  const toneClass =
    tone === "signed" && safeMinor < 0
      ? "text-[var(--numa-danger)]"
      : tone === "signed" && safeMinor > 0
        ? "text-[var(--numa-positive)]"
        : "";

  return (
    <span
      className={`inline-flex items-baseline gap-1.5 ${toneClass}`.trim()}
      aria-label={`${amountText} ${currencyText}`}
    >
      <span className={`money ${sizeClass}`}>{amountText}</span>
      <span
        className={`money-currency ${codeSize} text-[var(--numa-muted)]`}
      >
        {currencyText}
      </span>
    </span>
  );
}
