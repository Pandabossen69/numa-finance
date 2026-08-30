import type { CanonicalTransaction } from "@/domain/finance";
import {
  NEXT_INCOME_NAME,
  spendingCategoriesByMonthKey,
  type LedgerMatchTx,
  type SpendingCategoryTotal,
  isPlanIncome,
  isPlanSavings,
  monthKeyFromDate,
  projectLivingBudget,
  projectPayCycle,
  type PlanItem,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import { getCachedTodaySnapshot } from "@/features/finance/load-home";
import {
  buildAnalysMonth,
  labelIncomeDate,
  toAnalysLine,
  type AnalysLine,
  type AnalysMonthView,
} from "@/features/finance/analys-month";
import { loadErrorMessageSv } from "@/lib/async";

export type { AnalysLine } from "@/features/finance/analys-month";

/** Ledger rows Analys needs: enough for the matcher and for the Senaste list. */
export type AnalysLedgerTx = LedgerMatchTx &
  Pick<CanonicalTransaction, "category" | "currency">;

export type AnalysSnapshot = {
  currency: CurrencyCode;
  hasBankTruth: boolean;
  monthKey: string;
  calculatedBalanceMinor: number | null;
  todaySpendingMinor: number;
  monthSpendingMinor: number;
  cycleSpendingMinor: number;
  cycle: {
    startAt: string | null;
    endAt: string | null;
    startLabelSv: string | null;
    endLabelSv: string | null;
    isActive: boolean;
    livingMode: "bridge" | "cycle" | "empty";
    incomeMinor: number;
    expenseMinor: number;
    savingsMinor: number;
    freeToSpendMinor: number;
    remainingFreeMinor: number;
    daysLeft: number;
    nextIncomeLabelSv: string | null;
    dayBudgetMinor: number;
    remainingTodayMinor: number;
    incomes: AnalysLine[];
    expenses: AnalysLine[];
  };
  month: AnalysMonthView;
  timeZone: string;
  currentMonthKey: string;
  planItems: PlanItem[];
  spendingByMonthKey: Record<string, number>;
  ledgerTransactions: AnalysLedgerTx[];
  saldoMinor: number | null;
  categoriesByMonthKey: Record<string, SpendingCategoryTotal[]>;
  goals: AnalysLine[];
  formula: {
    steps: string[];
  };
};

export type AnalysSnapshotResult =
  { ok: true; data: AnalysSnapshot } | { ok: false; error: string };



export async function loadAnalysSnapshot(): Promise<AnalysSnapshotResult> {
  try {
    const snap = await getCachedTodaySnapshot();
    const timeZone = snap.profile.timezone || "Asia/Bangkok";
    const now = new Date();
    const monthKey = monthKeyFromDate(now, timeZone);
    const cycle = projectPayCycle(snap.planItems ?? [], now, timeZone);
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
    const planItems = snap.planItems ?? [];
    const spendingByMonthKey = snap.monthSpendingByKey ?? {};
    const ledgerTransactions = snap.ledgerTransactions ?? [];
    // Same rows as the month totals, split by category, for every month the
    // user can browse to.
    const categoriesByMonthKey = spendingCategoriesByMonthKey({
      transactions: ledgerTransactions,
      currency: snap.currency,
      timeZone,
    });
    const month = buildAnalysMonth({
      planItems,
      spendingByMonthKey,
      ledgerTransactions,
      saldoMinor: snap.calculatedBalanceMinor,
      monthKey,
      currentMonthKey: monthKey,
      timeZone,
    });
    const remainingFreeMinor = living.remainingFreeMinor;
    const dayBudgetMinor = living.dayBudgetMinor;
    const remainingTodayMinor = living.remainingTodayMinor;

    const cycleIncomes: AnalysLine[] = cycle.incomes.map((i) =>
      toAnalysLine(i, { detail: labelIncomeDate(i.nextDueAt, timeZone) }),
    );

    const cycleExpenses: AnalysLine[] = cycle.expenses.map(({ item, dueAt }) =>
      toAnalysLine(item, {
        id: `${item.id}:${dueAt}`,
        detail: labelIncomeDate(dueAt, timeZone),
      }),
    );

    const goals: AnalysLine[] = planItems
      .filter(
        (p) =>
          p.isActive &&
          p.kind === "goal" &&
          p.name !== NEXT_INCOME_NAME &&
          !isPlanIncome(p) &&
          !isPlanSavings(p),
      )
      .map((g) => toAnalysLine(g, { detail: "Mål" }));


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
        calculatedBalanceMinor: snap.calculatedBalanceMinor,
        todaySpendingMinor: snap.todaySpendingMinor,
        monthSpendingMinor: snap.monthSpendingMinor,
        cycleSpendingMinor,
        cycle: {
          startAt: cycle.startAt,
          endAt: cycle.endAt,
          startLabelSv: cycle.startLabelSv,
          endLabelSv: cycle.endLabelSv,
          isActive: cycle.isActive && snap.fundingConfirmed,
          livingMode: living.mode,
          incomeMinor: cycle.incomeMinor,
          expenseMinor: cycle.expenseMinor,
          savingsMinor: cycle.savingsMinor,
          freeToSpendMinor: cycle.freeToSpendMinor,
          remainingFreeMinor,
          daysLeft: living.daysUntilHorizon,
          nextIncomeLabelSv: living.nextIncomeLabelSv,
          dayBudgetMinor,
          remainingTodayMinor,
          incomes: cycleIncomes,
          expenses: cycleExpenses,
        },
        month,
        timeZone,
        currentMonthKey: monthKey,
        planItems,
        spendingByMonthKey,
        ledgerTransactions,
        saldoMinor: snap.calculatedBalanceMinor,
        categoriesByMonthKey,
        goals,
        formula: { steps: formulaSteps },
      },
    };
  } catch (error) {
    console.error("[numa] loadAnalysSnapshot failed", error);
    return {
      ok: false,
      error: loadErrorMessageSv(error, "Kunde inte hämta analysen"),
    };
  }
}
