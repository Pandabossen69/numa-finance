"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { CanonicalTransaction, CashCoverageView, PlanItem } from "@/domain/finance";
import { cashCoverageHintSv, planWealthTotalMinor } from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import { Icon } from "@/components/ui/Icon";
import { InfoNote } from "@/components/ui/InfoNote";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { PileLine } from "@/components/ui/PileLine";
import { parsePlanAmount } from "@/components/plan/plan-format";
import { SV } from "@/features/copy/labels-sv";
import { useValueForKey } from "@/lib/hooks/use-value-for-key";
import {
  previewMonthSavings,
  savingsPreviewLineSv,
} from "@/features/plan/savings-preview";

export function PlanPiles({
  coverage,
  monthName,
  priorMonthName,
  timeZone,
  currency,
  savingsTotalMinor,
  savingsThisMonthMinor,
  savingsPriorMinor,
  savingsSeed,
  savingsResetKey,
  monthKey,
  planItems,
  savingsCurrentMinor,
  ledgerTransactions,
  saldoMinor,
  cycleSpendingMinor,
  todaySpendingMinor,
  fundingConfirmed = false,
  canPreview = true,
  onSaveSavings,
  onClearSavings,
  savingsBusy = false,
  clearBusy = false,
}: {
  coverage: CashCoverageView;
  monthName: string;
  priorMonthName?: string;
  timeZone: string;
  currency: CurrencyCode;
  savingsTotalMinor: number;
  savingsThisMonthMinor: number;
  savingsPriorMinor: number;
  savingsByMonth: Record<string, number>;
  monthKeys: string[];
  savingsSeed: string;
  savingsResetKey: string;
  monthKey: string;
  planItems: PlanItem[];
  savingsCurrentMinor: number;
  ledgerTransactions: CanonicalTransaction[];
  saldoMinor: number | null;
  cycleSpendingMinor: number;
  todaySpendingMinor: number;
  fundingConfirmed?: boolean;
  canPreview?: boolean;
  onSaveSavings: (amount: string) => void;
  onClearSavings: () => Promise<boolean>;
  savingsBusy?: boolean;
  clearBusy?: boolean;
}) {
  const overOk = coverage.overMinor >= 0;
  const totalMinor = planWealthTotalMinor(coverage.overMinor, savingsTotalMinor);
  const hasThisMonth = savingsThisMonthMinor > 0;
  const hasPrior = savingsPriorMinor > 0;
  const showPriorAsHero = !hasThisMonth && hasPrior;
  const heroMinor = showPriorAsHero ? savingsPriorMinor : savingsThisMonthMinor;

  const reserved = coverage.reservedSavingsMinor;
  const hint = cashCoverageHintSv(reserved);

  return (
    <div className="numa-panel-list">
      <div className="grid items-stretch md:grid-cols-2">
        <section
          className="numa-pile flex h-full min-w-0 flex-col gap-3 px-4 py-4"
          aria-labelledby="plan-over-heading"
        >
          <div className="min-w-0">
            <div className="flex items-center">
              <p id="plan-over-heading" className="numa-section-title">
                {monthName}
              </p>
              <InfoNote label="Om på kontona">{SV.saldoAllaKontonHint}</InfoNote>
            </div>
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
            {coverage.savingsPriorMinor > 0 && !showPriorAsHero ? (
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
              <span className="numa-card-title">{SV.alltINuma}</span>
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
          className="numa-pile flex h-full min-w-0 flex-col gap-3 border-t border-[var(--numa-border)] px-4 py-4 md:border-t-0 md:border-l"
          aria-labelledby="plan-sparande-heading"
        >
          <p id="plan-sparande-heading" className="numa-section-title min-w-0">
            {showPriorAsHero ? SV.sparat : SV.sparaI(monthName)}
          </p>
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
          <div className="flex items-center">
            <p className="numa-pile-hint">
              {hasThisMonth
                ? `Taget från Över i ${monthName}.`
                : hasPrior
                  ? `Sparat från ${priorMonthName ?? "tidigare månader"}.`
                  : "Sätt av från Över."}
            </p>
            <InfoNote label="Om sparande">
              {hasThisMonth
                ? `Taget från Över och dagsbudgeten i ${monthName}. Inte pengar att leva upp.`
                : hasPrior
                  ? `Sparat från ${priorMonthName ?? "tidigare månader"} — satt av från Över. Inte att leva upp.`
                  : "Sätt av från Över det som inte ska levas upp. Sänker Över och dagsbudgeten. Nästa månad syns det som sparat."}
            </InfoNote>
          </div>

          <div className="mt-auto border-t border-[var(--numa-border)] pt-2">
            <PlanSavingsDraft
              monthName={monthName}
              hasThisMonth={hasThisMonth}
              seed={savingsSeed}
              resetKey={savingsResetKey}
              monthKey={monthKey}
              planItems={planItems}
              savingsCurrentMinor={savingsCurrentMinor}
              currency={currency}
              ledgerTransactions={ledgerTransactions}
              saldoMinor={saldoMinor}
              cycleSpendingMinor={cycleSpendingMinor}
              todaySpendingMinor={todaySpendingMinor}
              fundingConfirmed={fundingConfirmed}
              canPreview={canPreview}
              timeZone={timeZone}
              savingsBusy={savingsBusy}
              clearBusy={clearBusy}
              onSave={onSaveSavings}
              onClear={onClearSavings}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

const PlanSavingsDraft = memo(function PlanSavingsDraft({
  monthName,
  hasThisMonth,
  seed,
  resetKey,
  monthKey,
  planItems,
  savingsCurrentMinor,
  currency,
  timeZone,
  ledgerTransactions,
  saldoMinor,
  cycleSpendingMinor,
  todaySpendingMinor,
  fundingConfirmed,
  canPreview,
  savingsBusy,
  clearBusy,
  onSave,
  onClear,
}: {
  monthName: string;
  hasThisMonth: boolean;
  seed: string;
  resetKey: string;
  monthKey: string;
  planItems: PlanItem[];
  savingsCurrentMinor: number;
  currency: CurrencyCode;
  timeZone: string;
  ledgerTransactions: CanonicalTransaction[];
  saldoMinor: number | null;
  cycleSpendingMinor: number;
  todaySpendingMinor: number;
  fundingConfirmed: boolean;
  canPreview: boolean;
  savingsBusy: boolean;
  clearBusy: boolean;
  onSave: (amount: string) => void;
  onClear: () => Promise<boolean>;
}) {
  const [savingsAmount, setSavingsAmount] = useValueForKey(seed, resetKey);
  const [sheetOpen, setSheetOpen] = useState(false);
  const draftSavingsMinor = useMemo(() => {
    const parsed = parsePlanAmount(savingsAmount.trim() === "" ? "0" : savingsAmount);
    return typeof parsed === "number" ? parsed : null;
  }, [savingsAmount]);
  const livePreview = useMemo(() => {
    if (!canPreview || draftSavingsMinor == null) return null;
    return previewMonthSavings({
      items: planItems,
      monthKey,
      draftMinor: draftSavingsMinor,
      currentMinor: savingsCurrentMinor,
      currency,
      timeZone,
      ledgerTransactions,
      saldoMinor,
      cycleSpendingMinor,
      todaySpendingMinor,
      fundingConfirmed,
    });
  }, [
    canPreview,
    currency,
    cycleSpendingMinor,
    draftSavingsMinor,
    fundingConfirmed,
    ledgerTransactions,
    monthKey,
    planItems,
    saldoMinor,
    savingsCurrentMinor,
    timeZone,
    todaySpendingMinor,
  ]);

  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (sheetOpen) {
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          dialog.setAttribute("open", "");
        }
      }
      return;
    }
    if (dialog.open) dialog.close();
  }, [sheetOpen]);

  return (
    <>
      <dialog
        ref={dialogRef}
        className="numa-sheet-dialog"
        aria-label={`Sätt av från Över i ${monthName}`}
        onClose={() => setSheetOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setSheetOpen(false);
        }}
      >
        <div className="numa-sheet space-y-3">
          <p className="text-[15px] font-semibold tracking-tight">
            {SV.sattAvFranOver}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={savingsAmount}
              onChange={(e) => setSavingsAmount(e.target.value)}
              placeholder="t.ex. 2 000"
              aria-label={`Sätt av från Över i ${monthName}`}
              className="money min-h-11 w-full min-w-0 flex-1 rounded-[var(--numa-radius-sm)] border border-[var(--numa-border)] bg-[var(--numa-card)] px-3 text-base font-semibold outline-none focus:border-[var(--numa-accent)]"
            />
            <button
              type="button"
              disabled={savingsBusy}
              onClick={() => onSave(savingsAmount)}
              className="numa-btn numa-btn-primary min-h-11 px-4"
            >
              {savingsBusy ? "Sparar…" : hasThisMonth ? "Uppdatera" : SV.sattAvFranOver}
            </button>
            {hasThisMonth ? (
              <button
                type="button"
                disabled={clearBusy || savingsBusy}
                onClick={() => {
                  void onClear().then((ok) => {
                    if (ok) setSavingsAmount("");
                  });
                }}
                className="numa-press min-h-11 px-3 text-sm font-semibold text-[var(--numa-muted)] disabled:opacity-45"
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
      </dialog>
      <button
        type="button"
        className="numa-text-link w-full justify-start"
        onClick={() => setSheetOpen(true)}
      >
        {hasThisMonth ? `Ändra ${monthName}` : SV.sattAvFranOver}
        <Icon icon={ChevronRight} size={16} />
      </button>
    </>
  );
});
