import { CASH_COVERAGE_HINT_SV } from "@/domain/finance";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import type { CurrencyCode } from "@/domain/money";
import { SV } from "@/features/copy/labels-sv";

/**
 * Quiet total of the two piles. Över (Plan/Hem) or Mot planen (Analys)
 * stays separate from sparande.
 */
export function WealthScoreboard({
  livingMinor,
  livingLabel = SV.motPlanen,
  savingsMinor,
  totalMinor,
  currency,
}: {
  livingMinor: number;
  livingLabel?: string;
  savingsMinor: number;
  totalMinor: number;
  currency: CurrencyCode;
}) {
  const livingOk = livingMinor >= 0;
  return (
    <div className="numa-wealth-score" aria-label={SV.alltINuma}>
      <div className="min-w-0">
        <p className="numa-section-title">{livingLabel}</p>
        <div
          className={`mt-1 ${livingOk ? "text-[var(--numa-positive)]" : "text-[var(--numa-alarm)]"}`}
        >
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
  saldoMinor,
  incomingMinor,
  unpaidMinor,
  overMinor,
  savingsMinor,
  currency,
}: {
  saldoMinor: number | null;
  incomingMinor: number;
  unpaidMinor: number;
  overMinor: number;
  savingsMinor: number;
  currency: CurrencyCode;
}) {
  const overOk = overMinor >= 0;
  return (
    <div className="grid gap-3">
      <div className="numa-panel-strong numa-cash-board min-w-0 px-4 py-4">
        <p className="numa-section-title">{SV.over}</p>
        <div
          className={`mt-1 min-w-0 overflow-hidden ${
            overOk ? "text-[var(--numa-positive)]" : "text-[var(--numa-alarm)]"
          }`}
        >
          <MoneyDisplay
            amountMinor={overMinor}
            currency={currency}
            size="lg"
            compact
            align="start"
            wrap={false}
            tone="signed"
          />
        </div>
        <p className="mt-1.5 text-[12px] leading-snug text-[var(--numa-faint)]">
          {CASH_COVERAGE_HINT_SV}
        </p>
        <div className="mt-4 space-y-2.5 border-t border-[var(--numa-border)] pt-3">
          <p className="flex min-w-0 items-baseline justify-between gap-2 text-sm leading-snug">
            <span className="text-[var(--numa-muted)]">{SV.saldo}</span>
            <span className="min-w-0 overflow-hidden text-[var(--numa-ink)]">
              {saldoMinor == null ? (
                <span className="text-base font-medium text-[var(--numa-faint)]">—</span>
              ) : (
                <MoneyDisplay
                  amountMinor={saldoMinor}
                  currency={currency}
                  size="sm"
                  compact
                  align="end"
                  wrap={false}
                />
              )}
            </span>
          </p>
          <p className="flex min-w-0 items-baseline justify-between gap-2 text-sm leading-snug">
            <span className="text-[var(--numa-muted)]">{SV.kommerIn}</span>
            <span className="min-w-0 overflow-hidden text-[var(--numa-accent-ink)]">
              <MoneyDisplay
                amountMinor={incomingMinor}
                currency={currency}
                size="sm"
                compact
                align="end"
                wrap={false}
              />
            </span>
          </p>
          <p className="flex min-w-0 items-baseline justify-between gap-2 text-sm leading-snug">
            <span className="text-[var(--numa-muted)]">{SV.kvarAttBetala}</span>
            <span className="min-w-0 overflow-hidden text-[var(--numa-ink)]">
              <MoneyDisplay
                amountMinor={unpaidMinor}
                currency={currency}
                size="sm"
                compact
                align="end"
                wrap={false}
              />
            </span>
          </p>
        </div>
      </div>
      <div className="numa-panel-park min-w-0 px-4 py-3.5">
        <p className="numa-section-title">{SV.sparande}</p>
        <div className="mt-1.5 min-w-0 overflow-hidden text-[var(--numa-ink)]">
          <MoneyDisplay
            amountMinor={savingsMinor}
            currency={currency}
            size="md"
            compact
            align="start"
            wrap={false}
          />
        </div>
        <p className="mt-1 text-[12px] text-[var(--numa-faint)]">{SV.sparandeTotalt}</p>
      </div>
    </div>
  );
}
