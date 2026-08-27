import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import type { CurrencyCode } from "@/domain/money";

/**
 * Compact transaction / plan line: title + optional meta, signed amount.
 */
export function TxnLine({
  title,
  meta,
  amountMinor,
  currency,
  signed = true,
}: {
  title: string;
  meta?: string | null;
  amountMinor: number;
  currency: CurrencyCode;
  signed?: boolean;
}) {
  return (
    <div className="numa-line-row">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-medium tracking-tight text-[var(--numa-ink)]">
          {title}
        </p>
        {meta ? (
          <p className="mt-0.5 truncate text-xs text-[var(--numa-faint)]">{meta}</p>
        ) : null}
      </div>
      <div className="min-w-0 shrink-0">
        <MoneyDisplay
          amountMinor={amountMinor}
          currency={currency}
          size="sm"
          compact
          align="end"
          wrap={false}
          tone={signed ? "signed" : "neutral"}
        />
      </div>
    </div>
  );
}
