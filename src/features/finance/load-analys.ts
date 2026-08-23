import {
  NEXT_INCOME_NAME,
  dayOfMonthFromIso,
  extraSaldoHintSv,
  formatListDateSv,
  isPlanIncome,
  isPlanSavings,
  isRecurringMonthly,
  labelDayOfMonthSv,
  labelMonthSv,
  monthKeyFromDate,
  monthLeftoverHintSv,
  monthLivingSaldoMinor,
  cumulativePlanSavingsMinor,
  planWealthTotalMinor,
  projectExtraSaldo,
  projectLivingBudget,
  projectPayCycle,
  projectPlanForMonth,
} from "@/domain/finance";
import { sanitizeMoneyDescription, type CurrencyCode } from "@/domain/money";
import { getCachedTodaySnapshot } from "@/features/finance/load-home";

export type AnalysLine = {
  id: string;
  name: string;
  amountMinor: number;
  detail: string;
};

export type AnalysSnapshot = {
  currency: CurrencyCode;
  hasBankTruth: boolean;
  monthKey: string;
  monthLabelSv: string;
  verificationLabel: string | null;
  calculatedBalanceMinor: number | null;
  todaySpendingMinor: number;
  monthSpendingMinor: number;
  cycleSpendingMinor: number;
  safeToSpendTodayMinor: number;
  safeToSpendWeekMinor: number;
  freeMinor: number;
  daysUntilIncome: number;
  cycle: {
    startLabelSv: string | null;
    endLabelSv: string | null;
    endInferred: boolean;
    isActive: boolean;
    livingMode: "bridge" | "cycle" | "empty";
    incomeMinor: number;
    expenseMinor: number;
    savingsMinor: number;
    freeToSpendMinor: number;
    remainingFreeMinor: number;
    daysLeft: number;
    dayBudgetMinor: number;
    remainingTodayMinor: number;
    incomes: AnalysLine[];
    expenses: AnalysLine[];
  };
  month: {
    incomeMinor: number;
    expenseMinor: number;
    savingsMinor: number;
    freeToSpendMinor: number;
    extraSaldoMinor: number;
    extraSaldoDrawnMinor: number;
    extraSaldoHint: string | null;
    extraCarriedInMinor: number;
    /** Calendar-month plan leftover minus spent (+ extra). Not bank cash. */
    livingSaldoMinor: number;
    savingsTotalMinor: number;
    wealthTotalMinor: number;
    monthLeftoverHint: string | null;
    monthResultMinor: number;
    spentMinor: number;
    incomes: AnalysLine[];
    expenses: AnalysLine[];
  };
  goals: AnalysLine[];
  recent: Array<{
    id: string;
    description: string;
    category: string | null;
    transactionType: string;
    direction: "debit" | "credit";
    amountMinor: number;
    currency: CurrencyCode;
  }>;
  formula: {
    steps: string[];
  };
};

export type AnalysSnapshotResult =
  { ok: true; data: AnalysSnapshot } | { ok: false; error: string };

function labelIncomeDate(iso: string | null, timeZone: string): string {
  if (!iso) return "Datum saknas";
  return formatListDateSv(iso, timeZone);
}

export async function loadAnalysSnapshot(): Promise<AnalysSnapshotResult> {
  try {
    const snap = await getCachedTodaySnapshot();
    const timeZone = snap.profile.timezone || "Asia/Bangkok";
    const now = new Date();
    const monthKey = monthKeyFromDate(now, timeZone);
    const cycle = projectPayCycle(snap.planItems ?? [], now, timeZone);
    const month = projectPlanForMonth(snap.planItems ?? [], monthKey, timeZone);
    const cycleSpendingMinor = snap.cycleSpendingMinor ?? 0;
    const living = projectLivingBudget({
      cycle,
      now,
      timeZone,
      bankBalanceMinor: snap.calculatedBalanceMinor,
      cycleSpendingMinor,
      todaySpendingMinor: snap.todaySpendingMinor,
      fundingConfirmed: snap.fundingConfirmed,
    });
    const extra = projectExtraSaldo({
      planItems: snap.planItems ?? [],
      spendingByMonthKey: snap.monthSpendingByKey ?? {},
      monthKey,
      currentMonthKey: monthKey,
      timeZone,
    });
    const livingSaldoMinor = monthLivingSaldoMinor(extra);
    const savingsTotalMinor = cumulativePlanSavingsMinor(
      snap.planItems ?? [],
      monthKey,
      timeZone,
    );
    const remainingFreeMinor = living.remainingFreeMinor;
    const dayBudgetMinor = living.dayBudgetMinor;
    const remainingTodayMinor = living.remainingTodayMinor;

    const cycleIncomes: AnalysLine[] = cycle.incomes.map((i) => ({
      id: i.id,
      name: i.name,
      amountMinor: i.amountMinor,
      detail: labelIncomeDate(i.nextDueAt, timeZone),
    }));

    const cycleExpenses: AnalysLine[] = cycle.expenses.map(({ item, dueAt }) => ({
      id: `${item.id}:${dueAt}`,
      name: item.name,
      amountMinor: item.amountMinor,
      detail: labelIncomeDate(dueAt, timeZone),
    }));

    const monthIncomes: AnalysLine[] = month.incomes.map((i) => ({
      id: i.id,
      name: i.name,
      amountMinor: i.amountMinor,
      detail: labelIncomeDate(i.nextDueAt, timeZone),
    }));

    const monthExpenses: AnalysLine[] = month.items.map((item) => {
      const recurring = isRecurringMonthly(item);
      return {
        id: item.id,
        name: item.name,
        amountMinor: item.amountMinor,
        detail: recurring
          ? item.nextDueAt != null
            ? `Varje månad · ${labelDayOfMonthSv(dayOfMonthFromIso(item.nextDueAt))}`
            : "Varje månad"
          : item.nextDueAt != null
            ? `Engång · ${labelIncomeDate(item.nextDueAt, timeZone)}`
            : "Engång",
      };
    });

    const goals: AnalysLine[] = (snap.planItems ?? [])
      .filter(
        (p) =>
          p.isActive &&
          p.kind === "goal" &&
          p.name !== NEXT_INCOME_NAME &&
          !isPlanIncome(p) &&
          !isPlanSavings(p),
      )
      .map((g) => ({
        id: g.id,
        name: g.name,
        amountMinor: g.amountMinor,
        detail: "Mål",
      }));

    const recent = (snap.recentTransactions ?? []).slice(0, 10).map((tx) => ({
      id: tx.id,
      description: sanitizeMoneyDescription(tx.description),
      category: tx.category,
      transactionType: tx.transactionType,
      direction: tx.direction,
      amountMinor: tx.amountMinor,
      currency: tx.currency,
    }));

    const formulaSteps =
      living.mode === "bridge"
        ? [
            "Innan nästa intäkt lever du på saldot på kontot.",
            "Dagsbudget = saldo ÷ dagar kvar (samma belopp hela dagen).",
            "Kvar idag = dagsbudget − det du spenderat idag.",
            "Mot planen = kvar i månaden (plan) − spenderat i månaden. Det är inte saldot på kontot.",
            "Löneperiodens utgifter kan skilja sig från kalendermånadens.",
            "Det som blir över en månad följer med som extra saldo.",
            "När intäkterna kommer växlar Hem till periodens budget.",
          ]
        : living.mode === "empty"
          ? [
              "Lägg in intäkter med datum i Plan.",
              "Då startar en period och du får en dagsbudget på Hem.",
            ]
          : cycle.phase === "partial"
            ? [
                "Tidiga intäkter ingår redan i budgeten.",
                "Dagsbudget räknas fram till månadens sista intäkt.",
                "Kvar idag = dagsbudget − spenderat idag. Andra dagar ändras inte mitt på dagen.",
                "När sista intäkten kommer räknas perioden om till nästa.",
                "Mot planen = kvar i månaden (plan) − spenderat i månaden. Det är inte saldot på kontot.",
                "Löneperiodens utgifter kan skilja sig från kalendermånadens.",
                "Det som blir över en månad följer med som extra saldo.",
              ]
            : [
                "Intäkterna i perioden minus planerade utgifter och sparande = kvar i perioden.",
                "Mot planen = kvar i månaden (plan) − spenderat i månaden. Det är inte saldot på kontot.",
                "Löneperiodens utgifter kan skilja sig från kalendermånadens.",
                "Det som blir över en månad följer med som extra saldo.",
                "Dagsbudget = kvar i perioden (på morgonen) ÷ dagar kvar.",
                "Kvar idag = dagsbudget − spenderat idag. Andra dagar ändras inte.",
              ];

    return {
      ok: true,
      data: {
        currency: snap.currency,
        hasBankTruth: snap.checkpoint != null,
        monthKey,
        monthLabelSv: labelMonthSv(monthKey),
        verificationLabel: snap.verificationLabel,
        calculatedBalanceMinor: snap.calculatedBalanceMinor,
        todaySpendingMinor: snap.todaySpendingMinor,
        monthSpendingMinor: snap.monthSpendingMinor,
        cycleSpendingMinor,
        safeToSpendTodayMinor: living.remainingTodayMinor,
        safeToSpendWeekMinor: snap.safeToSpendWeekMinor,
        freeMinor: snap.freeMinor,
        daysUntilIncome: snap.daysUntilIncome,
        cycle: {
          startLabelSv: cycle.startLabelSv,
          endLabelSv: cycle.endLabelSv,
          endInferred: cycle.endInferred,
          isActive: cycle.isActive && snap.fundingConfirmed,
          livingMode: living.mode,
          incomeMinor: cycle.incomeMinor,
          expenseMinor: cycle.expenseMinor,
          savingsMinor: cycle.savingsMinor,
          freeToSpendMinor: cycle.freeToSpendMinor,
          remainingFreeMinor,
          daysLeft: living.daysLeft,
          dayBudgetMinor,
          remainingTodayMinor,
          incomes: cycleIncomes,
          expenses: cycleExpenses,
        },
        month: {
          incomeMinor: month.incomeMinor,
          expenseMinor: month.totalPlannedMinor,
          savingsMinor: month.savingsMinor,
          freeToSpendMinor: month.freeToSpendMinor,
          extraSaldoMinor: extra.extraSaldoMinor,
          extraSaldoDrawnMinor: extra.drawnMinor,
          extraSaldoHint: extraSaldoHintSv(extra, monthKey) ?? null,
          extraCarriedInMinor: extra.carriedInMinor,
          livingSaldoMinor,
          savingsTotalMinor,
          wealthTotalMinor: planWealthTotalMinor(livingSaldoMinor, savingsTotalMinor),
          monthLeftoverHint: monthLeftoverHintSv(extra, monthKey) ?? null,
          monthResultMinor: extra.monthResultMinor,
          spentMinor: extra.spentMinor,
          incomes: monthIncomes,
          expenses: monthExpenses,
        },
        goals,
        recent,
        formula: { steps: formulaSteps },
      },
    };
  } catch (error) {
    console.error("[numa] loadAnalysSnapshot failed", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte hämta analysen",
    };
  }
}
