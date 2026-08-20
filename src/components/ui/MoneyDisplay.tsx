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
}: {
  amountMinor: number;
  currency: CurrencyCode;
  size?: "sm" | "md" | "lg" | "xl" | "display";
  compact?: boolean;
  /** Color negative amounts as danger when "signed". */
  tone?: "neutral" | "signed";
  align?: "start" | "center" | "end";
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
            ? "text-xl font-semibold"
            : "text-base font-medium";

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
      ? "text-[var(--numa-danger)]"
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
      className={`inline-flex max-w-full flex-wrap items-baseline gap-x-1.5 gap-y-0 ${alignClass} ${toneClass}`.trim()}
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
