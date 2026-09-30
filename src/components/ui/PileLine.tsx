import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { usesAlarmColor } from "@/components/ui/amount-tone";
import type { CurrencyCode } from "@/domain/money";

/**
 * One cash-coverage row (Saldo / Kommer in / Kvar att betala / Över).
 * Type size is locked in CSS so Plan and Hem stay one family.
 */
export function PileLine({
  label,
  amountMinor,
  currency,
  tone = "plain",
}: {
  label: string;
  amountMinor: number | null;
  currency: CurrencyCode;
  tone?: "plain" | "in" | "out" | "over" | "short";
}) {
  const missing = amountMinor == null;
  const rowTone =
    tone === "over"
      ? " is-over"
      : tone === "short"
        ? " is-short"
        : tone === "in"
          ? " is-in"
          : tone === "out"
            ? " is-out"
            : "";
  const valueTone = missing
    ? "text-[var(--numa-faint)]"
    : tone === "in"
      ? "numa-amt-in"
      : "";
  const moneyTone =
    tone === "over" || tone === "short" || usesAlarmColor(amountMinor)
      ? "signed"
      : "neutral";

  return (
    <p className={`numa-pile-line${rowTone}`}>
      <span className="numa-pile-line-label">{label}</span>
      <span className={`numa-pile-line-value ${valueTone}`.trim()}>
        {missing ? (
          "—"
        ) : (
          <MoneyDisplay
            amountMinor={amountMinor}
            currency={currency}
            size="sm"
            compact
            align="end"
            wrap={false}
            tone={moneyTone}
          />
        )}
      </span>
    </p>
  );
}
