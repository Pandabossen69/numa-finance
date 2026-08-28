import { toMajorUnits, money, type CurrencyCode } from "@/domain/money";
import { CURRENCY_META } from "@/domain/money/currency";

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
  wrap = true,
}: {
  amountMinor: number;
  currency: CurrencyCode;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "display";
  compact?: boolean;
  /** Color negative amounts as clay alarm when "signed" — not destroy red. */
  tone?: "neutral" | "signed";
  align?: "start" | "center" | "end";
  wrap?: boolean;
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
    size === "display"
      ? "text-[clamp(1.35rem,4.8vw,2.35rem)] leading-[1.08] font-semibold tracking-[-0.04em]"
      : size === "xl"
        ? "text-[clamp(1.75rem,5vw,2.55rem)] leading-[1.08] font-semibold tracking-tight"
        : size === "lg"
          ? "text-3xl font-semibold tracking-tight"
          : size === "md"
            ? "text-[1.125rem] font-semibold tracking-tight"
            : size === "sm"
              ? "text-[0.9375rem] font-semibold tracking-tight"
              : "text-[0.8125rem] font-medium tracking-tight";

  const codeSize =
    size === "display"
      ? "text-[0.78rem] font-semibold tracking-[0.08em]"
      : size === "xl"
        ? "text-[1.05rem] font-semibold tracking-[0.04em]"
        : size === "lg"
          ? "text-sm font-semibold tracking-[0.04em]"
          : size === "md"
            ? "text-[0.75rem] font-semibold tracking-[0.06em]"
            : size === "sm"
              ? "text-[0.6875rem] font-semibold tracking-[0.07em]"
              : "text-[0.625rem] font-semibold tracking-[0.07em]";

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
      className={`numa-money ${alignClass}${wrap ? "" : " is-nowrap"} ${toneClass}`.trim()}
      aria-label={`${amountText} ${currencyText}`}
    >
      <span className={`money numa-money-amt ${sizeClass}`}>{amountText}</span>
      <span className={`money-currency numa-money-unit ${codeSize} text-[var(--numa-muted)]`}>
        {currencyText}
      </span>
    </span>
  );
}
