import { cashCoverageHintSv } from "@/domain/finance";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { PileLine } from "@/components/ui/PileLine";
import { formatMoneyCompact, money, type CurrencyCode } from "@/domain/money";
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
      <div className="numa-wealth-cell is-live">
        <p className="numa-section-title">{livingLabel}</p>
        <div
          className={`numa-wealth-value ${livingOk ? "text-[var(--numa-positive)]" : "text-[var(--numa-alarm)]"}`}
        >
          <MoneyDisplay
            amountMinor={livingMinor}
            currency={currency}
            size="md"
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
      <div className="numa-wealth-cell is-park">
        <p className="numa-section-title">{SV.sparande}</p>
        <div className="numa-wealth-value text-[var(--numa-ink)]">
          <MoneyDisplay
            amountMinor={savingsMinor}
            currency={currency}
            size="md"
            compact
            align="start"
            wrap={false}
          />
        </div>
      </div>
      <p className="numa-wealth-op" aria-hidden>
        =
      </p>
      <div className="numa-wealth-cell is-all">
        <p className="numa-section-title">{SV.alltINuma}</p>
        <div className="numa-wealth-value text-[var(--numa-accent-ink)]">
          <MoneyDisplay
            amountMinor={totalMinor}
            currency={currency}
            size="md"
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
  savingsThisMonthMinor = 0,
  savingsMonthName,
  currency,
}: {
  saldoMinor: number | null;
  incomingMinor: number;
  unpaidMinor: number;
  overMinor: number;
  savingsMinor: number;
  /** Current calendar month avsättning — remaining is prior «sparat». */
  savingsThisMonthMinor?: number;
  /** Same heading as Plan: «Spara i [månad]». */
  savingsMonthName?: string;
  currency: CurrencyCode;
}) {
  const overOk = overMinor >= 0;
  const thisMonth = Math.max(0, savingsThisMonthMinor);
  const prior = Math.max(0, savingsMinor - thisMonth);
  const parkHeading =
    thisMonth > 0 && savingsMonthName
      ? SV.sparaI(savingsMonthName)
      : prior > 0
        ? SV.sparat
        : SV.sparande;
  const parkAmount = thisMonth > 0 ? thisMonth : savingsMinor;
  return (
    <div className="numa-piles-board">
      <div className="is-live min-w-0">
        <div className="numa-pile-stack">
          <PileLine label={SV.saldo} amountMinor={saldoMinor} currency={currency} />
          <PileLine
            label={SV.kommerIn}
            amountMinor={incomingMinor}
            currency={currency}
            tone="in"
          />
          <PileLine
            label={SV.kvarAttBetala}
            amountMinor={unpaidMinor}
            currency={currency}
            tone="out"
          />
          <PileLine
            label={SV.over}
            amountMinor={overMinor}
            currency={currency}
            tone={overOk ? "over" : "short"}
          />
        </div>
        <p className="numa-pile-hint mt-3">{cashCoverageHintSv(savingsMinor)}</p>
      </div>
      <div className="is-park min-w-0">
        <div className="numa-pile-save-copy">
          <p className="numa-section-title">{parkHeading}</p>
          <p className="numa-pile-hint">{SV.sparandeHintHem}</p>
          {thisMonth > 0 && prior > 0 ? (
            <p className="numa-pile-hint">
              {SV.sparandeTotalt} {formatMoneyCompact(money(prior, currency))}
            </p>
          ) : null}
        </div>
        <div className="numa-pile-save-value min-w-0 text-[var(--numa-ink)]">
          <MoneyDisplay
            amountMinor={parkAmount}
            currency={currency}
            size="sm"
            compact
            align="end"
            wrap={false}
          />
        </div>
      </div>
    </div>
  );
}
