import type { ReactNode } from "react";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import type { CurrencyCode } from "@/domain/money";

type Tone = "positive" | "danger" | "alarm";

/**
 * Shared money metric row — warm separators via `.numa-row`.
 */
export function MetricRow({
  label,
  amountMinor,
  currency,
  hint,
  tone,
  value,
}: {
  label: string;
  amountMinor?: number;
  currency?: CurrencyCode;
  hint?: string;
  tone?: Tone;
  /** Override money display (e.g. em dash when missing). */
  value?: ReactNode;
}) {
  const amountClass =
    tone === "positive"
      ? "text-[var(--numa-positive)]"
      : tone === "alarm"
        ? "text-[var(--numa-alarm)]"
        : tone === "danger"
          ? "text-[var(--numa-danger)]"
          : "text-[var(--numa-ink)]";

  return (
    <div className="numa-row">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--numa-muted)]">{label}</p>
        {hint ? (
          <p className="mt-0.5 text-xs leading-snug text-[var(--numa-faint)]">
            {hint}
          </p>
        ) : null}
      </div>
      <div className={`min-w-0 max-w-full text-right ${amountClass}`}>
        {value != null ? (
          value
        ) : amountMinor != null && currency != null ? (
          <MoneyDisplay
            amountMinor={amountMinor}
            currency={currency}
            size="md"
            compact
            align="end"
          />
        ) : (
          <span className="text-sm text-[var(--numa-faint)]">—</span>
        )}
      </div>
    </div>
  );
}
