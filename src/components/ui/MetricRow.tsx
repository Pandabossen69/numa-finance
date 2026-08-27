import type { ReactNode } from "react";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import type { CurrencyCode } from "@/domain/money";

type Tone = "positive" | "danger" | "alarm";

function toneClass(tone?: Tone) {
  return tone === "positive"
    ? "text-[var(--numa-positive)]"
    : tone === "alarm"
      ? "text-[var(--numa-alarm)]"
      : tone === "danger"
        ? "text-[var(--numa-danger)]"
        : "text-[var(--numa-ink)]";
}

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
  const amountClass = toneClass(tone);

  return (
    <div className="numa-row">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--numa-muted)]">{label}</p>
        {hint ? (
          <p className="mt-0.5 text-xs leading-snug text-[var(--numa-faint)]">{hint}</p>
        ) : null}
      </div>
      <div className={`max-w-full min-w-0 text-right ${amountClass}`}>
        {value != null ? (
          value
        ) : amountMinor != null && currency != null ? (
          <MoneyDisplay
            amountMinor={amountMinor}
            currency={currency}
            size="sm"
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

/** Compact 3-up metrics — one surface, not three cards. */
export function CompactMetricGrid({
  items,
}: {
  items: Array<{
    label: string;
    amountMinor: number;
    currency: CurrencyCode;
    tone?: Tone;
  }>;
}) {
  return (
    <div className="numa-metrics">
      {items.map((item) => (
        <div key={item.label}>
          <p className="numa-metrics-label">{item.label}</p>
          <div className={`numa-metrics-value ${toneClass(item.tone)}`}>
            <MoneyDisplay
              amountMinor={item.amountMinor}
              currency={item.currency}
              size="sm"
              compact
              align="start"
              wrap={false}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
