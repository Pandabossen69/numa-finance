import { MetricRow } from "@/components/ui/MetricRow";
import type { CurrencyCode } from "@/domain/money";
import { SV } from "@/features/copy/labels-sv";

export function ExtraSaldoRow({
  extraSaldoMinor,
  drawnMinor = 0,
  hint,
  currency,
}: {
  extraSaldoMinor: number;
  drawnMinor?: number;
  hint?: string | null;
  currency: CurrencyCode;
}) {
  if (extraSaldoMinor === 0 && drawnMinor === 0) return null;
  return (
    <MetricRow
      label={SV.extraSaldo}
      amountMinor={extraSaldoMinor}
      currency={currency}
      tone={extraSaldoMinor > 0 ? "positive" : undefined}
      hint={hint ?? undefined}
    />
  );
}
