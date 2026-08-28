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
      <div className="numa-wealth-cell is-live min-w-0">
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
            wrap={false}
          />
        </div>
      </div>
      <p className="numa-wealth-op" aria-hidden>
        +
      </p>
      <div className="numa-wealth-cell is-park min-w-0">
        <p className="numa-section-title">{SV.sparande}</p>
        <div className="mt-1 text-[var(--numa-ink)]">
          <MoneyDisplay
            amountMinor={savingsMinor}
            currency={currency}
            size="sm"
            compact
            align="start"
            wrap={false}
          />
        </div>
      </div>
      <p className="numa-wealth-op" aria-hidden>
        =
      </p>
      <div className="numa-wealth-cell is-all min-w-0 text-right sm:text-left">
        <p className="numa-section-title">{SV.alltINuma}</p>
        <div className="mt-1 text-[var(--numa-accent-ink)]">
          <MoneyDisplay
            amountMinor={totalMinor}
            currency={currency}
            size="sm"
            compact
            align="start"
            wrap={false}
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
    <div className="numa-piles-board">
      <div className="is-live min-w-0">
        <p className="numa-section-title">{SV.saldo}</p>
        <div className="mt-1.5 min-w-0 overflow-hidden text-[var(--numa-ink)]">
          {saldoMinor == null ? (
            <span className="text-base font-medium text-[var(--numa-faint)]">—</span>
          ) : (
            <MoneyDisplay
              amountMinor={saldoMinor}
              currency={currency}
              size="sm"
              compact
              align="start"
              wrap={false}
            />
          )}
        </div>
        <p className="mt-2 flex min-w-0 items-baseline justify-between gap-2 text-[11px] leading-snug numa-amt-in">
          <span>{SV.kommerIn}</span>
          <MoneyDisplay
            amountMinor={incomingMinor}
            currency={currency}
            size="xs"
            compact
            align="end"
            wrap={false}
          />
        </p>
        <p className="mt-1 flex min-w-0 items-baseline justify-between gap-2 text-[11px] leading-snug numa-amt-out">
          <span>{SV.kvarAttBetala}</span>
          <MoneyDisplay
            amountMinor={unpaidMinor}
            currency={currency}
            size="xs"
            compact
            align="end"
            wrap={false}
          />
        </p>
        <p
          className={`mt-1.5 flex min-w-0 items-baseline justify-between gap-2 text-[11px] leading-snug ${
            overOk ? "text-[var(--numa-positive)]" : "text-[var(--numa-alarm)]"
          }`}
        >
          <span>{SV.over}</span>
          <MoneyDisplay
            amountMinor={overMinor}
            currency={currency}
            size="xs"
            compact
            align="end"
            wrap={false}
            tone="signed"
          />
        </p>
        <p className="mt-1.5 text-[11px] leading-snug text-[var(--numa-faint)]">
          {CASH_COVERAGE_HINT_SV}
        </p>
      </div>
      <div className="is-park min-w-0">
        <p className="numa-section-title">{SV.sparande}</p>
        <div className="mt-1.5 min-w-0 overflow-hidden text-[var(--numa-ink)]">
          <MoneyDisplay
            amountMinor={savingsMinor}
            currency={currency}
            size="sm"
            compact
            align="start"
            wrap={false}
          />
        </div>
        <p className="mt-1 min-h-[1.15rem] text-[11px] text-[var(--numa-faint)]">
          {SV.sparandeTotalt}
        </p>
        <p className="mt-1 min-h-[2.5rem]" aria-hidden />
      </div>
    </div>
  );
}
