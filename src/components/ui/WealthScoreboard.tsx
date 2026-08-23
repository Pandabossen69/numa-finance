import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import type { CurrencyCode } from "@/domain/money";
import { SV } from "@/features/copy/labels-sv";

/**
 * Quiet total of the two piles. Mot planen and sparande stay separate —
 * this is plan leftover vs spend plus avsatt sparande, not cash on hand.
 */
export function WealthScoreboard({
  livingMinor,
  savingsMinor,
  totalMinor,
  currency,
}: {
  livingMinor: number;
  savingsMinor: number;
  totalMinor: number;
  currency: CurrencyCode;
}) {
  return (
    <div className="numa-wealth-score" aria-label={SV.alltINuma}>
      <div className="min-w-0">
        <p className="numa-section-title">{SV.motPlanen}</p>
        <div className="mt-1 text-[var(--numa-positive)]">
          <MoneyDisplay
            amountMinor={livingMinor}
            currency={currency}
            size="sm"
            compact
            tone="signed"
            align="start"
          />
        </div>
      </div>
      <p className="numa-wealth-op" aria-hidden>
        +
      </p>
      <div className="min-w-0">
        <p className="numa-section-title">{SV.sparande}</p>
        <div className="mt-1 text-[var(--numa-ink)]">
          <MoneyDisplay
            amountMinor={savingsMinor}
            currency={currency}
            size="sm"
            compact
            align="start"
          />
        </div>
      </div>
      <p className="numa-wealth-op" aria-hidden>
        =
      </p>
      <div className="min-w-0 text-right sm:text-left">
        <p className="numa-section-title">{SV.alltINuma}</p>
        <div className="mt-1 text-[var(--numa-accent-ink)]">
          <MoneyDisplay
            amountMinor={totalMinor}
            currency={currency}
            size="sm"
            compact
            align="start"
          />
        </div>
      </div>
    </div>
  );
}

export function CompactPiles({
  livingMinor,
  savingsMinor,
  currency,
  livingHint,
}: {
  livingMinor: number;
  savingsMinor: number;
  currency: CurrencyCode;
  livingHint?: string;
}) {
  const livingOk = livingMinor >= 0;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="numa-panel-strong min-w-0 px-3.5 py-3.5">
        <p className="numa-section-title">{SV.motPlanen}</p>
        <div
          className={`mt-1.5 ${livingOk ? "text-[var(--numa-positive)]" : "text-[var(--numa-danger)]"}`}
        >
          <MoneyDisplay
            amountMinor={livingMinor}
            currency={currency}
            size="md"
            compact
            align="start"
          />
        </div>
        <p className="mt-1 text-[11px] text-[var(--numa-faint)]">
          {livingOk ? SV.saldoLevaFor : SV.minusMotPlanen}
        </p>
        {livingHint ? (
          <p className="mt-1 text-[11px] leading-snug text-[var(--numa-faint)]">
            {livingHint}
          </p>
        ) : null}
      </div>
      <div className="numa-panel-park min-w-0 px-3.5 py-3.5">
        <p className="numa-section-title">{SV.sparande}</p>
        <div className="mt-1.5 text-[var(--numa-ink)]">
          <MoneyDisplay
            amountMinor={savingsMinor}
            currency={currency}
            size="md"
            compact
            align="start"
          />
        </div>
        <p className="mt-1 text-[11px] text-[var(--numa-faint)]">{SV.sparandeTotalt}</p>
      </div>
    </div>
  );
}
