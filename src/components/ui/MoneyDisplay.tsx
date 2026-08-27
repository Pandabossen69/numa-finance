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
  align = "center",
  wrap = true,
}: {
  amountMinor: number;
  currency: CurrencyCode;
  size?: "sm" | "md" | "lg" | "xl" | "display";
  compact?: boolean;
  /** Color and sign prefix when "signed" — minus/plus, not color alone. */
  tone?: "neutral" | "signed";
  align?: "start" | "center" | "end";
  wrap?: boolean;
}) {
  const safeMinor = Number.isInteger(amountMinor)
    ? amountMinor
    : Math.round(Number.isFinite(amountMinor) ? amountMinor : 0);
  const value = money(safeMinor, currency);
  const showFraction = compact ? Math.abs(safeMinor) % 100 !== 0 : true;
  const major = toMajorUnits(value);
  const amountText = new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: showFraction ? 2 : 0,
    maximumFractionDigits: showFraction ? 2 : 0,
    useGrouping: true,
  }).format(tone === "signed" ? Math.abs(major) : major);
  const signPrefix =
    tone === "signed" ? (safeMinor < 0 ? "−" : safeMinor > 0 ? "+" : "") : "";
  const currencyText = CURRENCY_META[currency].symbol;

  const sizeClass =
    size === "display"
      ? "text-[clamp(1.85rem,5.2vw,2.25rem)] leading-[1.08] font-semibold tracking-[-0.04em]"
      : size === "xl"
        ? "text-[clamp(1.7rem,4.6vw,2.15rem)] leading-[1.08] font-semibold tracking-tight"
        : size === "lg"
          ? "text-[1.5rem] font-semibold tracking-tight"
          : size === "md"
            ? "text-[1.25rem] font-semibold tracking-tight"
            : "text-[0.9375rem] font-medium";

  const codeSize =
    size === "display"
      ? "text-[0.78rem] font-semibold tracking-[0.08em]"
      : size === "xl"
        ? "text-[1.05rem] font-semibold tracking-[0.04em]"
        : size === "lg"
          ? "text-sm font-semibold tracking-[0.04em]"
          : size === "md"
            ? "text-xs font-semibold tracking-[0.06em]"
            : "text-[0.65rem] font-semibold tracking-[0.06em]";

  const toneClass =
    tone === "signed" && safeMinor < 0
      ? "text-[var(--numa-alarm)]"
      : tone === "signed" && safeMinor > 0
        ? "text-[var(--numa-positive)]"
        : "";

  const alignClass =
    align === "start"
      ? "justify-start"
      : align === "end"
        ? "justify-end"
        : "justify-center";

  return (
    <span
      className={`inline-flex max-w-full items-baseline gap-x-1.5 gap-y-0 ${wrap ? "flex-wrap" : "flex-nowrap"} ${alignClass} ${toneClass}`.trim()}
      aria-label={`${signPrefix}${amountText} ${currencyText}`}
    >
      <span className={`money ${sizeClass}`}>
        {signPrefix}
        {amountText}
      </span>
      <span className={`money-currency ${codeSize} text-[var(--numa-muted)]`}>
        {currencyText}
      </span>
    </span>
  );
}
