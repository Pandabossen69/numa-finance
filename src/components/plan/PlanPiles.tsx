"use client";

import type { ExtraSaldoView } from "@/domain/finance";
import {
  extraSaldoHintSv,
  livingVsPlanHintSv,
  monthLeftoverHintSv,
  monthPileBreakdown,
  planWealthTotalMinor,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { WealthScoreboard } from "@/components/ui/WealthScoreboard";
import { SV } from "@/features/copy/labels-sv";

export function PlanPiles({
  extra,
  currentMonthKey,
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
  showSpent,
  dayBudgetMinor,
  savingsBusy = false,
  clearBusy = false,
}: {
  extra: ExtraSaldoView;
  currentMonthKey: string;
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
  showSpent: boolean;
  dayBudgetMinor: number | null;
  savingsBusy?: boolean;
  clearBusy?: boolean;
}) {
  const piles = monthPileBreakdown(extra);
  const leftoverHint = monthLeftoverHintSv(extra, currentMonthKey);
  const extraHint = extraSaldoHintSv(extra, currentMonthKey);
  const livingOk = piles.livingMinor >= 0;
  const totalMinor = planWealthTotalMinor(piles.livingMinor, savingsTotalMinor);
  const remainRatio =
    piles.poolMinor > 0 && livingOk
      ? Math.min(1, Math.max(0, piles.livingMinor / piles.poolMinor))
      : livingOk
        ? 1
        : 0;
  const monthsWithSavings = monthKeys.filter(
    (key) => (savingsByMonth[key] ?? 0) > 0,
  ).length;
  const savingsFill = monthKeys.length > 0 ? monthsWithSavings / monthKeys.length : 0;

  const saldoChip = !livingOk
    ? SV.minusMotPlanen
    : extra.monthResultMinor > 0
      ? SV.vaxer
      : piles.extraInMinor > 0
        ? SV.extraMed
        : SV.saldoLevaFor;

  const savingsChip =
    savingsThisMonthMinor > 0 ? SV.vaxer : savingsTotalMinor > 0 ? "Avsatt" : "Tomt";

  return (
    <div className="space-y-4">
      <WealthScoreboard
        livingMinor={piles.livingMinor}
        savingsMinor={savingsTotalMinor}
        totalMinor={totalMinor}
        currency={currency}
      />

      <div className="grid items-stretch gap-4 md:grid-cols-2">
        <section
          className="numa-panel-strong numa-pile flex h-full min-w-0 flex-col gap-3 p-5 pl-6"
          aria-labelledby="plan-saldo-heading"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <p id="plan-saldo-heading" className="numa-section-title min-w-0">
              {SV.motPlanen} · {monthName}
            </p>
            <span
              className={`numa-chip shrink-0 ${livingOk ? "numa-chip-mint" : "numa-chip-alarm"}`}
            >
              {saldoChip}
            </span>
          </div>
          <div
            className={
              livingOk ? "text-[var(--numa-positive)]" : "text-[var(--numa-alarm)]"
            }
          >
            <MoneyDisplay
              amountMinor={piles.livingMinor}
              currency={currency}
              size="lg"
              compact
              align="start"
            />
          </div>
          <p className="text-sm leading-snug text-[var(--numa-muted)]">
            {livingOk
              ? SV.saldoLevaFor
              : `Du har handlat mer än ${monthName} planerat.`}
          </p>
          {showSpent ? (
            <p className="text-xs leading-snug text-[var(--numa-faint)]">
              {livingVsPlanHintSv(extra)}
            </p>
          ) : null}

          <div className="numa-pile-meter" aria-hidden>
            <i
              className={livingOk ? "" : "is-alarm"}
              style={{ transform: `scaleX(${Math.max(0.04, remainRatio)})` }}
            />
          </div>

          <div className="mt-auto space-y-2 pt-1">
            {piles.showBreakdown ? (
              <>
                <PileLine
                  label={SV.iManaden}
                  amountMinor={piles.monthSliceMinor}
                  currency={currency}
                  danger={piles.monthSliceMinor < 0}
                />
                <PileLine
                  label={SV.extraMed}
                  amountMinor={piles.extraInMinor}
                  currency={currency}
                  accent
                />
              </>
            ) : extra.drawnMinor > 0 ? (
              <p className="text-sm text-[var(--numa-alarm)]">{extraHint}</p>
            ) : null}
            {showSpent && extra.spentMinor > 0 ? (
              <PileLine
                label={SV.spenderatIManaden}
                amountMinor={extra.spentMinor}
                currency={currency}
              />
            ) : null}
            {leftoverHint ? (
              <p className="text-sm text-[var(--numa-muted)]">{leftoverHint}</p>
            ) : extraHint &&
              piles.extraInMinor > 0 &&
              extra.monthKey > currentMonthKey ? (
              <p className="text-sm text-[var(--numa-muted)]">{extraHint}</p>
            ) : null}
            {dayBudgetMinor != null && dayBudgetMinor > 0 ? (
              <p className="text-sm text-[var(--numa-muted)]">
                <MoneyDisplay
                  amountMinor={dayBudgetMinor}
                  currency={currency}
                  size="sm"
                  compact
                  align="start"
                />{" "}
                / dag
              </p>
            ) : null}
          </div>
        </section>

        <section
          className="numa-panel-park numa-pile flex h-full min-w-0 flex-col gap-3 p-5 pl-6"
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
              size="lg"
              compact
              align="start"
            />
          </div>
          <p className="text-sm leading-snug text-[var(--numa-muted)]">
            {savingsTotalMinor <= 0
              ? "Inget avsatt än"
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
                transform: `scaleX(${Math.max(0.04, savingsFill || (savingsTotalMinor > 0 ? 0.22 : 0.04))})`,
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
            <p className="text-xs font-semibold tracking-[0.12em] text-[var(--numa-faint)] uppercase">
              Avsätt i {monthName}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={savingsAmount}
                onChange={(e) => onSavingsAmount(e.target.value)}
                placeholder="Belopp"
                aria-label={`Sparande i ${monthName}`}
                className="money min-h-11 w-full max-w-[9rem] min-w-0 rounded-xl border border-[var(--numa-border)] bg-white px-3 text-base font-semibold outline-none focus:border-[var(--numa-accent)]"
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

function PileLine({
  label,
  amountMinor,
  currency,
  accent = false,
  danger = false,
}: {
  label: string;
  amountMinor: number;
  currency: CurrencyCode;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <p className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-[var(--numa-muted)]">{label}</span>
      <span
        className={
          danger
            ? "text-[var(--numa-alarm)]"
            : accent
              ? "text-[var(--numa-accent-ink)]"
              : "text-[var(--numa-ink)]"
        }
      >
        <MoneyDisplay
          amountMinor={amountMinor}
          currency={currency}
          size="sm"
          compact
          align="end"
        />
      </span>
    </p>
  );
}
