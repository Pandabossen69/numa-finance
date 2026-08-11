import {
  NEXT_INCOME_NAME,
  dayOfMonthFromIso,
  isPlanIncome,
  isPlanSavings,
  isRecurringMonthly,
  labelDayOfMonthSv,
  labelMonthSv,
  monthKeyFromDate,
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
    perDayMinor: number;
    incomes: AnalysLine[];
    expenses: AnalysLine[];
  };
  month: {
    incomeMinor: number;
    expenseMinor: number;
    savingsMinor: number;
    freeToSpendMinor: number;
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
  | { ok: true; data: AnalysSnapshot }
  | { ok: false; error: string };

function labelIncomeDate(iso: string | null, timeZone: string): string {
  if (!iso) return "Datum saknas";
  return new Date(iso).toLocaleDateString("sv-SE", {
    timeZone,
    day: "numeric",
    month: "short",
  });
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
    });
    const remainingFreeMinor = living.remainingFreeMinor;
    const perDayMinor = living.perDayMinor;

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
            "Innan nästa intäkt lever du på det som finns kvar på kontot (från förra månaden).",
            "Ange saldo manuellt eller fota bank-SMS / kvitto — då uppdateras saldot.",
            "Kvar per dag = saldo ÷ dagar kvar till nästa intäkt.",
            "När intäkterna landar växlar Hem till plan-poolen för den månaden.",
          ]
        : living.mode === "empty"
          ? [
              "Lägg in intäkter med datum i Plan — då startar en inkomstcykel.",
              "Fota bank-SMS eller ange saldo på Hem så att kvar per dag kan räknas.",
            ]
          : cycle.phase === "partial"
            ? [
                "Tidiga intäkter i månaden ingår redan i budgeten.",
                "Kvar per dag räknas fram till månadens sista intäkt (då blir det mer per dag).",
                "När sista intäkten landar räknas hela poolen om till nästa månads sista intäkt.",
              ]
            : [
                "Alla intäkter samma kalendermånad räknas ihop (t.ex. Alltid ID + CSN + Trukks).",
                "Den poolen ska täcka fasta + extra utgifter fram till nästa månads sista intäkt.",
                "Planerat fritt = intäkter − utgifter i perioden − sparande.",
                "Kvar totalt = planerat fritt − faktiskt spenderat sedan periodens start.",
                "Kvar per dag = kvar totalt ÷ dagar kvar till nästa månads sista intäkt.",
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
        safeToSpendTodayMinor: snap.safeToSpendTodayMinor,
        safeToSpendWeekMinor: snap.safeToSpendWeekMinor,
        freeMinor: snap.freeMinor,
        daysUntilIncome: snap.daysUntilIncome,
        cycle: {
          startLabelSv: cycle.startLabelSv,
          endLabelSv: cycle.endLabelSv,
          endInferred: cycle.endInferred,
          isActive: cycle.isActive,
          livingMode: living.mode,
          incomeMinor: cycle.incomeMinor,
          expenseMinor: cycle.expenseMinor,
          savingsMinor: cycle.savingsMinor,
          freeToSpendMinor: cycle.freeToSpendMinor,
          remainingFreeMinor,
          daysLeft: living.daysLeft,
          perDayMinor,
          incomes: cycleIncomes,
          expenses: cycleExpenses,
        },
        month: {
          incomeMinor: month.incomeMinor,
          expenseMinor: month.totalPlannedMinor,
          savingsMinor: month.savingsMinor,
          freeToSpendMinor: month.freeToSpendMinor,
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
      error:
        error instanceof Error ? error.message : "Kunde inte hämta analysen",
    };
  }
}
