import { toMajorUnits, money, type CurrencyCode } from "@/domain/money";
import { CURRENCY_META } from "@/domain/money/currency";

const GROUPING_SPACE = /[\u0020\u00A0\u202F\u2009]/g;

/**
 * Swedish-grouped amount with non-breaking grouping so "12 450" cannot wrap
 * between thousands. Currency is not part of this string.
 */
export function formatSvGroupedNumber(majorUnits: number, fractionDigits: 0 | 2): string {
  return new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: true,
  })
    .format(majorUnits)
    .replace(GROUPING_SPACE, "\u00A0");
}

/**
 * Money display: amount in tabular mono, currency code in a fixed unit column.
 * THB shows as "10 108,04 THB" — never the ฿ glyph (reads as $ in many fonts).
 */
export function MoneyDisplay({
  amountMinor,
  currency,
  size = "md",
  compact = false,
  tone = "neutral",
  align = "center",
  wrap = false,
}: {
  amountMinor: number;
  currency: CurrencyCode;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "display";
  compact?: boolean;
  /** Color negative amounts as clay alarm when "signed" — not destroy red. */
  tone?: "neutral" | "signed";
  align?: "start" | "center" | "end";
  /** When true, the unit may wrap under the amount. Digits never wrap. */
  wrap?: boolean;
}) {
  const safeMinor = Number.isInteger(amountMinor)
    ? amountMinor
    : Math.round(Number.isFinite(amountMinor) ? amountMinor : 0);
  const value = money(safeMinor, currency);
  const showFraction = compact ? Math.abs(safeMinor) % 100 !== 0 : true;
  const amountText = formatSvGroupedNumber(toMajorUnits(value), showFraction ? 2 : 0);
  const currencyText = CURRENCY_META[currency].symbol;

  const sizeClass =
    size === "display"
      ? "text-[clamp(1.7rem,6.2vw,2.7rem)] leading-[1.05] font-bold tracking-[-0.045em]"
      : size === "xl"
        ? "text-[clamp(1.95rem,5.5vw,2.75rem)] leading-[1.05] font-bold tracking-tight"
        : size === "lg"
          ? "text-3xl font-bold tracking-tight"
          : size === "md"
            ? "text-[1.2rem] font-bold tracking-tight"
            : size === "sm"
              ? "text-[1.0625rem] font-bold tracking-tight"
              : "text-[0.875rem] font-semibold tracking-tight";

  const codeSize =
    size === "display"
      ? "text-[0.9rem] font-bold tracking-[0.06em]"
      : size === "xl"
        ? "text-[1.05rem] font-bold tracking-[0.04em]"
        : size === "lg"
          ? "text-sm font-bold tracking-[0.04em]"
          : size === "md"
            ? "text-[0.8rem] font-bold tracking-[0.05em]"
            : size === "sm"
              ? "text-[0.72rem] font-bold tracking-[0.06em]"
              : "text-[0.68rem] font-semibold tracking-[0.06em]";

  const toneClass =
    tone === "signed" && safeMinor < 0
      ? "text-[var(--numa-alarm)]"
      : tone === "signed" && safeMinor > 0
        ? "text-[var(--numa-positive)]"
        : "";

  const alignClass =
    align === "start" ? "is-start" : align === "end" ? "is-end" : "is-center";

  return (
    <span
      className={`numa-money ${alignClass}${wrap ? "" : "is-nowrap"} ${toneClass}`.trim()}
      aria-label={`${amountText} ${currencyText}`}
    >
      <span className={`money numa-money-amt ${sizeClass}`}>{amountText}</span>
      <span className={`money-currency numa-money-unit ${codeSize}`}>{currencyText}</span>
    </span>
  );
}
