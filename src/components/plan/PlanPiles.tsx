"use client";

import type { CashCoverageView } from "@/domain/finance";
import { CASH_COVERAGE_HINT_SV, planWealthTotalMinor } from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { PileLine } from "@/components/ui/PileLine";
import { WealthScoreboard } from "@/components/ui/WealthScoreboard";
import { SV } from "@/features/copy/labels-sv";

export function PlanPiles({
  coverage,
  monthName,
  currency,
  savingsTotalMinor,
  savingsThisMonthMinor,
  savingsByMonth,
  monthKeys,
  savingsAmount,
  onSavingsAmount,
  onSaveSavings,
  onClearSavings,
  savingsBusy = false,
  clearBusy = false,
}: {
  coverage: CashCoverageView;
  monthName: string;
  currency: CurrencyCode;
  savingsTotalMinor: number;
  savingsThisMonthMinor: number;
  savingsByMonth: Record<string, number>;
  monthKeys: string[];
  savingsAmount: string;
  onSavingsAmount: (value: string) => void;
  onSaveSavings: () => void;
  onClearSavings: () => void;
  savingsBusy?: boolean;
  clearBusy?: boolean;
}) {
  const overOk = coverage.overMinor >= 0;
  const totalMinor = planWealthTotalMinor(coverage.overMinor, savingsTotalMinor);
  const monthsWithSavings = monthKeys.filter(
    (key) => (savingsByMonth[key] ?? 0) > 0,
  ).length;
  const savingsFill = monthKeys.length > 0 ? monthsWithSavings / monthKeys.length : 0;

  const overChip = overOk ? SV.pengarOver : SV.rackerInte;
  const savingsChip =
    savingsThisMonthMinor > 0 ? SV.vaxer : savingsTotalMinor > 0 ? "Avsatt" : "Inte ännu";

  return (
    <div className="space-y-4">
      <WealthScoreboard
        livingMinor={coverage.overMinor}
        livingLabel={SV.over}
        savingsMinor={savingsTotalMinor}
        totalMinor={totalMinor}
        currency={currency}
      />

      <div className="grid items-stretch gap-4 md:grid-cols-2">
        <section
          className="numa-panel-strong numa-pile flex h-full min-w-0 flex-col gap-3 p-5"
          aria-labelledby="plan-over-heading"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <p id="plan-over-heading" className="numa-section-title min-w-0">
              {monthName}
            </p>
            <span
              className={`numa-chip shrink-0 ${overOk ? "numa-chip-mint" : "numa-chip-alarm"}`}
            >
              {overChip}
            </span>
          </div>

          <div className="numa-pile-stack">
            <PileLine
              label={SV.saldo}
              amountMinor={coverage.saldoMinor}
              currency={currency}
            />
            <PileLine
              label={SV.kommerIn}
              amountMinor={coverage.incomingMinor}
              currency={currency}
              tone="in"
            />
            <PileLine
              label={SV.kvarAttBetala}
              amountMinor={coverage.unpaidMinor}
              currency={currency}
              tone="out"
            />
            <PileLine
              label={SV.over}
              amountMinor={coverage.overMinor}
              currency={currency}
              tone={overOk ? "over" : "short"}
            />
          </div>
          <p className="numa-pile-hint">
            {CASH_COVERAGE_HINT_SV}
            {coverage.saldoMinor == null ? ". Lägg in saldo på Hem." : ""}
          </p>
        </section>

        <section
          className="numa-panel-park numa-pile flex h-full min-w-0 flex-col gap-3 p-5"
          aria-labelledby="plan-sparande-heading"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <p id="plan-sparande-heading" className="numa-section-title min-w-0">
              {SV.sparande} · {monthName}
            </p>
            <span className="numa-chip numa-chip-ink shrink-0">{savingsChip}</span>
          </div>
          <div className="text-[var(--numa-ink)]">
            <MoneyDisplay
              amountMinor={savingsTotalMinor}
              currency={currency}
              size="sm"
              compact
              align="start"
              wrap={false}
            />
          </div>
          <p className="numa-pile-hint">
            {savingsTotalMinor <= 0
              ? "Sätt av det som inte ska levas upp."
              : savingsThisMonthMinor <= 0
                ? "Sparat i tidigare månader"
                : savingsTotalMinor === savingsThisMonthMinor
                  ? `Avsatt i ${monthName}`
                  : "Sparat hittills"}
          </p>

          <div className="numa-year-dots" aria-hidden>
            {monthKeys.map((key) => (
              <span
                key={key}
                className={(savingsByMonth[key] ?? 0) > 0 ? "is-on" : undefined}
              />
            ))}
          </div>
          <div className="numa-pile-meter" aria-hidden>
            <i
              style={{
                transform: `scaleX(${
                  savingsTotalMinor > 0 ? Math.max(0.08, savingsFill || 0.22) : 0
                })`,
              }}
            />
          </div>

          {savingsTotalMinor > 0 &&
          savingsThisMonthMinor > 0 &&
          savingsTotalMinor !== savingsThisMonthMinor ? (
            <PileLine
              label={`I ${monthName}`}
              amountMinor={savingsThisMonthMinor}
              currency={currency}
            />
          ) : null}

          <div className="mt-auto space-y-2 pt-1">
            <p className="numa-section-title">Avsätt i {monthName}</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={savingsAmount}
                onChange={(e) => onSavingsAmount(e.target.value)}
                placeholder="t.ex. 2 000"
                aria-label={`Sparande i ${monthName}`}
                className="money min-h-11 w-full max-w-[9rem] min-w-0 rounded-xl border border-[var(--numa-border)] bg-[var(--numa-card)] px-3 text-base font-semibold outline-none focus:border-[var(--numa-accent)]"
              />
              <button
                type="button"
                disabled={savingsBusy}
                onClick={onSaveSavings}
                className="numa-btn numa-btn-primary min-h-11 px-4"
              >
                {savingsBusy ? "Sparar…" : "Avsätt"}
              </button>
              {savingsThisMonthMinor > 0 ? (
                <button
                  type="button"
                  disabled={clearBusy || savingsBusy}
                  onClick={onClearSavings}
                  className="numa-press text-sm font-semibold text-[var(--numa-muted)] disabled:opacity-45"
                >
                  {clearBusy ? "Sparar…" : "Nollställ"}
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
