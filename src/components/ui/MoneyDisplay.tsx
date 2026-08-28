import { toMajorUnits, money, type CurrencyCode } from "@/domain/money";
import { CURRENCY_META } from "@/domain/money/currency";

const GROUPING_SPACE = /[\u0020\u00A0\u202F\u2009]/;

/**
 * Swedish-grouped amount. Grouping is a thin no-break space so "12 450"
 * cannot wrap and does not open a monospace-digit hole.
 */
export function formatSvGroupedNumber(majorUnits: number, fractionDigits: 0 | 2): string {
  return svAmountGroups(majorUnits, fractionDigits).join("\u202F");
}

export function svAmountGroups(majorUnits: number, fractionDigits: 0 | 2): string[] {
  const raw = new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: true,
  }).format(majorUnits);
  const parts = raw.split(GROUPING_SPACE).filter((part) => part.length > 0);
  return parts.length > 0 ? parts : [raw];
}

function AmountRuns({ text }: { text: string }) {
  const parts = text.split(GROUPING_SPACE).filter((part) => part.length > 0);
  return (
    <span className="numa-money-groups">
      {parts.map((part, index) => (
        <span key={`${index}-${part}`} className="numa-money-run">{part}</span>
      ))}
    </span>
  );
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
      ? "text-[clamp(1.7rem,6.2vw,2.7rem)] leading-[1.2] font-bold"
      : size === "xl"
        ? "text-[clamp(1.95rem,5.5vw,2.75rem)] leading-[1.2] font-bold"
        : size === "lg"
          ? "text-3xl font-bold"
          : size === "md"
            ? "text-[1.125rem] font-bold"
            : size === "sm"
              ? "text-[1.0625rem] font-bold"
              : "text-[0.875rem] font-semibold";

  const codeSize =
    size === "display"
      ? "text-[0.9rem] font-bold"
      : size === "xl"
        ? "text-[1.05rem] font-bold"
        : size === "lg"
          ? "text-sm font-bold"
          : size === "md"
            ? "text-[0.75rem] font-bold"
            : size === "sm"
              ? "text-[0.72rem] font-bold"
              : "text-[0.68rem] font-semibold";

  const toneClass =
    tone === "signed" && safeMinor < 0
      ? "text-[var(--numa-alarm)]"
      : tone === "signed" && safeMinor > 0
        ? "text-[var(--numa-positive)]"
        : "";

  const alignClass =
    align === "start" ? "is-start" : align === "end" ? "is-end" : "is-center";

  const className = ["numa-money", alignClass, wrap ? null : "is-nowrap", toneClass]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={className} aria-label={`${amountText} ${currencyText}`}>
      <span className={`money numa-money-amt ${sizeClass}`}>
        <AmountRuns text={amountText} />
      </span>
      <span className={`money-currency numa-money-unit ${codeSize}`}>{currencyText}</span>
    </span>
  );
}
