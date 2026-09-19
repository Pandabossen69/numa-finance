"use client";

import type { CashCoverageView } from "@/domain/finance";
import { cashCoverageHintSv, planWealthTotalMinor } from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { PileLine } from "@/components/ui/PileLine";
import { SV } from "@/features/copy/labels-sv";
import {
  savingsPreviewLineSv,
  type MonthSavingsPreview,
} from "@/features/plan/savings-preview";

export function PlanPiles({
  coverage,
  monthName,
  priorMonthName,
  currency,
  savingsTotalMinor,
  savingsThisMonthMinor,
  savingsPriorMinor,
  savingsByMonth,
  monthKeys,
  savingsAmount,
  onSavingsAmount,
  onSaveSavings,
  onClearSavings,
  savingsBusy = false,
  clearBusy = false,
  livePreview = null,
}: {
  coverage: CashCoverageView;
  monthName: string;
  priorMonthName?: string;
  currency: CurrencyCode;
  savingsTotalMinor: number;
  savingsThisMonthMinor: number;
  savingsPriorMinor: number;
  savingsByMonth: Record<string, number>;
  monthKeys: string[];
  savingsAmount: string;
  onSavingsAmount: (value: string) => void;
  onSaveSavings: () => void;
  onClearSavings: () => void;
  savingsBusy?: boolean;
  clearBusy?: boolean;
  livePreview?: MonthSavingsPreview | null;
}) {
  const overOk = coverage.overMinor >= 0;
  const totalMinor = planWealthTotalMinor(coverage.overMinor, savingsTotalMinor);
  const monthsWithSavings = monthKeys.filter(
    (key) => (savingsByMonth[key] ?? 0) > 0,
  ).length;
  const savingsFill = monthKeys.length > 0 ? monthsWithSavings / monthKeys.length : 0;
  const hasThisMonth = savingsThisMonthMinor > 0;
  const hasPrior = savingsPriorMinor > 0;
  const showPriorAsHero = !hasThisMonth && hasPrior;
  const heroMinor = showPriorAsHero ? savingsPriorMinor : savingsThisMonthMinor;

  const overChip = overOk ? SV.pengarOver : SV.rackerInte;
  const savingsChip = hasThisMonth
    ? "Denna månad"
    : hasPrior
      ? "Tidigare månader"
      : "Inte ännu";

  const reserved = coverage.reservedSavingsMinor;
  const hint = cashCoverageHintSv(reserved);

  return (
    <div className="space-y-4">
      <div className="grid items-stretch gap-4 md:grid-cols-2">
        <section
          className="numa-panel-strong numa-pile flex h-full min-w-0 flex-col gap-3 p-5"
          aria-labelledby="plan-over-heading"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="min-w-0">
              <p id="plan-over-heading" className="numa-section-title">
                {monthName}
              </p>
              <p className="mt-1 text-[12px] leading-snug text-[var(--numa-faint)]">
                {SV.saldoAllaKontonHint}
              </p>
            </div>
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
            {coverage.savingsThisMonthMinor > 0 ? (
              <PileLine
                label={SV.sparandeAvsatt}
                amountMinor={coverage.savingsThisMonthMinor}
                currency={currency}
                tone="out"
              />
            ) : null}
            {coverage.savingsPriorMinor > 0 ? (
              <PileLine
                label={SV.sparat}
                amountMinor={coverage.savingsPriorMinor}
                currency={currency}
                tone="out"
              />
            ) : null}
            <PileLine
              label={SV.over}
              amountMinor={coverage.overMinor}
              currency={currency}
              tone={overOk ? "over" : "short"}
            />
          </div>
          <p className="numa-pile-hint">
            {hint}
            {coverage.saldoMinor == null ? ". Lägg in saldo på Hem." : ""}
          </p>
          {savingsTotalMinor > 0 ? (
            <div className="flex items-baseline justify-between gap-2 border-t border-[var(--numa-border)] pt-3">
              <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--numa-faint)]">
                {SV.alltINuma}
              </span>
              <MoneyDisplay
                amountMinor={totalMinor}
                currency={currency}
                size="sm"
                compact
                wrap={false}
              />
            </div>
          ) : null}
        </section>

        <section
          className="numa-panel-park numa-pile flex h-full min-w-0 flex-col gap-3 p-5"
          aria-labelledby="plan-sparande-heading"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <p id="plan-sparande-heading" className="numa-section-title min-w-0">
              {showPriorAsHero ? SV.sparat : SV.sparaI(monthName)}
            </p>
            <span className="numa-chip numa-chip-ink shrink-0">{savingsChip}</span>
          </div>
          <div className="text-[var(--numa-ink)]">
            <MoneyDisplay
              amountMinor={heroMinor}
              currency={currency}
              size="sm"
              compact
              align="start"
              wrap={false}
            />
          </div>
          <p className="numa-pile-hint">
            {hasThisMonth
              ? `Taget från Över och dagsbudgeten i ${monthName}. Inte pengar att leva upp.`
              : hasPrior
                ? `Sparat från ${priorMonthName ?? "tidigare månader"} — satt av från Över. Inte att leva upp.`
                : "Sätt av från Över det som inte ska levas upp. Sänker Över och dagsbudgeten. Nästa månad syns det som sparat."}
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

          {hasThisMonth && hasPrior ? (
            <PileLine
              label={
                priorMonthName
                  ? `Sparat från ${priorMonthName}`
                  : SV.sparandeTotalt
              }
              amountMinor={savingsPriorMinor}
              currency={currency}
            />
          ) : null}

          <div className="mt-auto space-y-2 pt-1">
            <p className="numa-section-title">
              {hasThisMonth ? `Ändra ${monthName}` : `Sätt av i ${monthName}`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={savingsAmount}
                onChange={(e) => onSavingsAmount(e.target.value)}
                placeholder="t.ex. 2 000"
                aria-label={`Sätt av från Över i ${monthName}`}
                className="money min-h-11 w-full max-w-[9rem] min-w-0 rounded-xl border border-[var(--numa-border)] bg-[var(--numa-card)] px-3 text-base font-semibold outline-none focus:border-[var(--numa-accent)]"
              />
              <button
                type="button"
                disabled={savingsBusy}
                onClick={onSaveSavings}
                className="numa-btn numa-btn-primary min-h-11 px-4"
              >
                {savingsBusy
                  ? "Sparar…"
                  : hasThisMonth
                    ? "Uppdatera"
                    : SV.sattAvFranOver}
              </button>
              {hasThisMonth ? (
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
            {livePreview ? (
              <p className="text-[12px] leading-snug text-[var(--numa-muted)]">
                {savingsPreviewLineSv(livePreview)}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
