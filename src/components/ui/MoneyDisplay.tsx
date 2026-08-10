import { formatMoney, formatMoneyCompact, money, type CurrencyCode } from "@/domain/money";

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
  const text = compact ? formatMoneyCompact(value) : formatMoney(value);

  const sizeClass =
    size === "xl"
      ? "text-[2.75rem] leading-none font-semibold tracking-tight"
      : size === "lg"
        ? "text-3xl font-semibold tracking-tight"
        : size === "md"
          ? "text-xl font-semibold"
          : "text-base font-medium";

  const toneClass =
    tone === "signed" && safeMinor < 0
      ? "text-[var(--numa-danger)]"
      : tone === "signed" && safeMinor > 0
        ? "text-[var(--numa-positive)]"
        : "";

  return <span className={`money ${sizeClass} ${toneClass}`.trim()}>{text}</span>;
}
