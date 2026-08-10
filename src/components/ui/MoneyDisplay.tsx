import { formatMoney, formatMoneyCompact, money, type CurrencyCode } from "@/domain/money";

export function MoneyDisplay({
  amountMinor,
  currency,
  size = "md",
  compact = false,
}: {
  amountMinor: number;
  currency: CurrencyCode;
  size?: "sm" | "md" | "lg" | "xl";
  compact?: boolean;
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

  return <span className={`money ${sizeClass}`}>{text}</span>;
}
