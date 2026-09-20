import type { CanonicalTransaction } from "@/domain/finance";
import {
  NEXT_INCOME_NAME,
  computeClassifiedSpendingWindows,
  hasCycleFundingEvidence,
  isPlanIncome,
  isPlanSavings,
  monthKeyFromDate,
  projectLedgerToCanonicalThb,
  projectLivingBudget,
  projectPayCycle,
  sortPlanRowsForList,
  spendingCategoriesByMonthKey,
  type FxCheckpoint,
  type LedgerMatchTx,
  type PlanItem,
  type SpendingCategoryTotal,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import {
  buildAnalysMonth,
  labelIncomeDate,
  toAnalysLine,
  type AnalysLine,
  type AnalysMonthView,
} from "@/features/finance/analys-month";
import type { AccountsSnapshot } from "@/features/finance/load-accounts";
import type { HomeSnapshot } from "@/features/finance/load-home";
import type { PlanSnapshot } from "@/features/finance/load-plan";
import type { TodaySnapshot } from "@/lib/store/types-snapshot";

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
  categoriesByMonthKey: Record<string, SpendingCategoryTotal[]>;
  goals: AnalysLine[];
  formula: {
    steps: string[];
  };
  financeRevision: string;
  verifiedAt: string;
  truthStatus: "verified" | "stale" | "unavailable";
};

type AnalysBuildInput = {
  currency: CurrencyCode;
  timeZone: string;
  hasBankTruth: boolean;
  calculatedBalanceMinor: number | null;
  todaySpendingMinor: number;
  monthSpendingMinor: number;
  cycleSpendingMinor: number;
  fundingConfirmed: boolean;
  planItems: PlanItem[];
  spendingByMonthKey: Record<string, number>;
  ledgerTransactions: CanonicalTransaction[];
  fxMap: Map<string, FxCheckpoint | null>;
  financeRevision: string;
  verifiedAt: string;
  truthStatus: AnalysSnapshot["truthStatus"];
};

/**
 * App-side FX map (checkpoint rate on the account) — same source Spenderat /
 * Rörelser use. Not numa.fx_conversions (often empty for local/test users).
 */
export function fxMapFromTodaySnap(
  snap: TodaySnapshot,
): Map<string, FxCheckpoint | null> {
  const byId = new Map(
    (snap.accountBalances ?? []).map((row) => [row.accountId, row]),
  );
  const map = new Map<string, FxCheckpoint | null>();
  for (const account of snap.accounts) {
    const bal = byId.get(account.id);
    if (!bal) {
      map.set(account.id, null);
      continue;
    }
    map.set(account.id, {
      accountId: account.id,
      balanceMinor: bal.nativeMinor ?? 0,
      thbMinor: bal.thbMinor,
      fxRate: bal.fxRate,
    });
  }
  return map;
}

function fxMapFromPlanAccounts(
  accounts?: AccountsSnapshot,
): Map<string, FxCheckpoint | null> {
  const map = new Map<string, FxCheckpoint | null>();
  if (!accounts) return map;
  for (const account of accounts.accounts) {
    if (
      account.calculatedMinor == null &&
      account.thbMinor == null &&
      account.fxRate == null
    ) {
      map.set(account.id, null);
      continue;
    }
    map.set(account.id, {
      accountId: account.id,
      balanceMinor: account.calculatedMinor ?? 0,
      thbMinor: account.thbMinor,
      fxRate: account.fxRate,
    });
  }
  return map;
}

function formulaStepsForLiving(
  mode: "bridge" | "cycle" | "empty",
  phase: string | null,
): string[] {
  if (mode === "bridge") {
    return [
      "Analys visar vart pengarna gick. Spenderat och kategorierna är samma belopp.",
      "Innan nästa intäkt lever du på saldot på kontot.",
      "Dagsbudget = saldo ÷ dagar kvar (samma belopp hela dagen).",
      "Kvar idag = dagsbudget − det du spenderat idag.",
      "Mot planen = kvar i månaden (plan) − spenderat i månaden. Det är inte saldot på kontot.",
      "Löneperiodens utgifter kan skilja sig från kalendermånadens.",
      "Det som blir över en månad följer med som extra saldo.",
      "När intäkterna kommer växlar Hem till periodens budget.",
    ];
  }
  if (mode === "empty") {
    return [
      "Analys visar vart pengarna gick när en period är igång.",
      "Lägg in intäkter med datum i Plan.",
      "Då startar en period och du får en dagsbudget på Hem.",
    ];
  }
  if (phase === "partial") {
    return [
      "Analys visar vart pengarna gick. Spenderat och kategorierna är samma belopp.",
      "Tidiga intäkter ingår redan i budgeten.",
      "Dagsbudget räknas fram till nästa inkomst — inte till periodens sista intäkt.",
      "Kvar idag = dagsbudget − spenderat idag. Andra dagar ändras inte mitt på dagen.",
      "När sista intäkten kommer räknas perioden om till nästa.",
      "Mot planen = kvar i månaden (plan) − spenderat i månaden. Det är inte saldot på kontot.",
      "Löneperiodens utgifter kan skilja sig från kalendermånadens.",
      "Det som blir över en månad följer med som extra saldo.",
    ];
  }
  return [
    "Analys visar vart pengarna gick. Spenderat och kategorierna är samma belopp.",
    "Intäkterna i perioden minus planerade utgifter och sparande = kvar i perioden.",
    "Mot planen = kvar i månaden (plan) − spenderat i månaden. Det är inte saldot på kontot.",
    "Löneperiodens utgifter kan skilja sig från kalendermånadens.",
    "Det som blir över en månad följer med som extra saldo.",
    "Dagsbudget = (saldo − planerat kvar) ÷ dagar till nästa inkomst.",
    "Kvar idag = dagsbudget − spenderat idag. Andra dagar ändras inte.",
  ];
}

function buildAnalysSnapshot(
  input: AnalysBuildInput,
  now = new Date(),
): AnalysSnapshot {
  const timeZone = input.timeZone || "Asia/Bangkok";
  const monthKey = monthKeyFromDate(now, timeZone);
  const cycle = projectPayCycle(input.planItems, now, timeZone);
  const living = projectLivingBudget({
    cycle,
    now,
    timeZone,
    bankBalanceMinor: input.calculatedBalanceMinor,
    cycleSpendingMinor: input.cycleSpendingMinor,
    todaySpendingMinor: input.todaySpendingMinor,
    fundingConfirmed: input.fundingConfirmed,
  });
  const spendingByMonthKey = input.spendingByMonthKey;
  // Same app-side FX→primary (THB) as Spenderat / Tx Utgifter. Native SEK
  // rows were skipped in Per kategori (currency !== THB) and Senaste still
  // painted KR (−1/−1/−20/−10) instead of THB (−3,50/−3,50/−70/−35).
  // Fixture: 10+20+1+1 SEK @ 3.5 = 112 THB → Övrigt 8× not 4×.
  const ledgerTransactions = projectLedgerToCanonicalThb(
    input.ledgerTransactions,
    input.fxMap,
  );
  const categoriesByMonthKey = spendingCategoriesByMonthKey({
    transactions: ledgerTransactions,
    currency: input.currency,
    timeZone,
  });
  const month = buildAnalysMonth({
    planItems: input.planItems,
    spendingByMonthKey,
    ledgerTransactions,
    saldoMinor: input.calculatedBalanceMinor,
    monthKey,
    currentMonthKey: monthKey,
    timeZone,
  });

  return {
    currency: input.currency,
    hasBankTruth: input.hasBankTruth,
    monthKey,
    calculatedBalanceMinor: input.calculatedBalanceMinor,
    todaySpendingMinor: input.todaySpendingMinor,
    monthSpendingMinor: input.monthSpendingMinor,
    cycleSpendingMinor: input.cycleSpendingMinor,
    cycle: {
      startAt: cycle.startAt,
      endAt: cycle.endAt,
      startLabelSv: cycle.startLabelSv,
      endLabelSv: cycle.endLabelSv,
      isActive: cycle.isActive && input.fundingConfirmed,
      livingMode: living.mode,
      incomeMinor: cycle.incomeMinor,
      expenseMinor: cycle.expenseMinor,
      savingsMinor: cycle.savingsMinor,
      freeToSpendMinor: cycle.freeToSpendMinor,
      remainingFreeMinor: living.remainingFreeMinor,
      daysLeft: living.daysUntilHorizon,
      nextIncomeLabelSv: living.nextIncomeLabelSv,
      dayBudgetMinor: living.dayBudgetMinor,
      remainingTodayMinor: living.remainingTodayMinor,
      incomes: cycle.incomes.map((item) =>
        toAnalysLine(item, { detail: labelIncomeDate(item.nextDueAt, timeZone) }),
      ),
      expenses: cycle.expenses.map(({ item, dueAt }) =>
        toAnalysLine(item, {
          id: `${item.id}:${dueAt}`,
          detail: labelIncomeDate(dueAt, timeZone),
        }),
      ),
    },
    month,
    timeZone,
    currentMonthKey: monthKey,
    planItems: input.planItems,
    spendingByMonthKey,
    ledgerTransactions,
    categoriesByMonthKey,
    goals: sortPlanRowsForList(
      input.planItems.filter(
        (item) =>
          item.isActive &&
          item.kind === "goal" &&
          item.name !== NEXT_INCOME_NAME &&
          !isPlanIncome(item) &&
          !isPlanSavings(item),
      ),
    ).map((goal) => toAnalysLine(goal, { detail: "Mål" })),
    formula: { steps: formulaStepsForLiving(living.mode, cycle.phase) },
    financeRevision: input.financeRevision,
    verifiedAt: input.verifiedAt,
    truthStatus: input.truthStatus,
  };
}

/** Last-known from Hem only — no ledger/plan yet. Enough to paint chrome. */
export function isThinAnalysSnapshot(
  snap: AnalysSnapshot | null | undefined,
): boolean {
  if (!snap) return true;
  return (
    (snap.planItems?.length ?? 0) === 0 &&
    (snap.ledgerTransactions?.length ?? 0) === 0
  );
}

/**
 * Paint-able Analys chrome from Hem last-known. Copies leftover / daysLeft
 * from Hem — does not recompute living math from an empty plan.
 */
export function analysSnapshotFromHome(
  home: HomeSnapshot,
  now = new Date(),
): AnalysSnapshot {
  const timeZone = home.timeZone || "Asia/Bangkok";
  const monthKey = home.monthKey || monthKeyFromDate(now, timeZone);
  const month = buildAnalysMonth({
    planItems: [],
    spendingByMonthKey: { [monthKey]: home.monthSpendingMinor },
    ledgerTransactions: [],
    saldoMinor: home.calculatedBalanceMinor,
    monthKey,
    currentMonthKey: monthKey,
    timeZone,
  });
  return {
    currency: home.currency,
    hasBankTruth: home.hasBankTruth,
    monthKey,
    calculatedBalanceMinor: home.calculatedBalanceMinor,
    todaySpendingMinor: home.todaySpendingMinor,
    monthSpendingMinor: home.monthSpendingMinor,
    cycleSpendingMinor: home.cycleSpendingMinor,
    cycle: {
      startAt: null,
      endAt: null,
      startLabelSv: home.cycleStartLabelSv,
      endLabelSv: home.cycleEndLabelSv,
      isActive: home.cycleIsActive,
      livingMode: home.livingMode,
      incomeMinor: home.planIncomeMinor,
      expenseMinor: home.planExpenseMinor,
      savingsMinor: home.planSavingsMinor,
      freeToSpendMinor: home.freeToSpendMinor,
      remainingFreeMinor: home.remainingFreeMinor,
      daysLeft: home.spendDaysLeft,
      nextIncomeLabelSv: home.nextIncomeLabelSv,
      dayBudgetMinor: home.dayBudgetMinor,
      remainingTodayMinor: home.remainingTodayMinor,
      incomes: [],
      expenses: [],
    },
    month,
    timeZone,
    currentMonthKey: monthKey,
    planItems: [],
    spendingByMonthKey: { [monthKey]: home.monthSpendingMinor },
    ledgerTransactions: [],
    categoriesByMonthKey:
      home.monthSpendingMinor > 0
        ? {
            [monthKey]: [
              {
                name: "Spenderat",
                amountMinor: home.monthSpendingMinor,
                count: 1,
              },
            ],
          }
        : {},
    goals: [],
    formula: {
      steps: [
        "Analys visar senast känt läge från Hem. Kategorier fylls i när hela analysen kommit.",
      ],
    },
    financeRevision: home.financeRevision,
    verifiedAt: home.verifiedAt,
    truthStatus: home.truthStatus === "unavailable" ? "unavailable" : "stale",
  };
}

/** Same numbers as `loadAnalysSnapshot`, without a second store read. */
export function analysSnapshotFromToday(
  snap: TodaySnapshot,
  now = new Date(),
): AnalysSnapshot {
  return buildAnalysSnapshot(
    {
      currency: snap.currency,
      timeZone: snap.profile.timezone || "Asia/Bangkok",
      hasBankTruth: snap.checkpoint != null,
      calculatedBalanceMinor: snap.calculatedBalanceMinor,
      todaySpendingMinor: snap.todaySpendingMinor,
      monthSpendingMinor: snap.monthSpendingMinor,
      cycleSpendingMinor: snap.cycleSpendingMinor ?? 0,
      fundingConfirmed: snap.fundingConfirmed,
      planItems: snap.planItems ?? [],
      spendingByMonthKey: snap.monthSpendingByKey ?? {},
      ledgerTransactions: snap.ledgerTransactions ?? [],
      fxMap: fxMapFromTodaySnap(snap),
      financeRevision: snap.financeRevision,
      verifiedAt: snap.verifiedAt,
      truthStatus: "verified",
    },
    now,
  );
}

/**
 * Paint-able Analys from Plan (+ Hem when warm). Same living/spend projections
 * as the server loader so leftover / daysLeft cannot drift on first tap.
 */
export function analysSnapshotFromPlan(
  plan: PlanSnapshot,
  home?: HomeSnapshot | null,
  now = new Date(),
): AnalysSnapshot {
  const timeZone = plan.timeZone || home?.timeZone || "Asia/Bangkok";
  const cycle = projectPayCycle(plan.items ?? [], now, timeZone);
  const fxMap = fxMapFromPlanAccounts(plan.accounts);
  const projectedLedger = projectLedgerToCanonicalThb(
    plan.ledgerTransactions ?? [],
    fxMap,
  );
  const windows = computeClassifiedSpendingWindows({
    transactions: projectedLedger,
    currency: plan.currency,
    now,
    timeZone,
    cycleStartAt: cycle.startAt,
    cycleEndAt: cycle.endAt,
  });
  const monthKey = monthKeyFromDate(now, timeZone);
  const fundingConfirmed =
    home?.cycleIsActive === true ||
    hasCycleFundingEvidence({
      cycleStartAt: cycle.startAt,
      cycleEndAt: cycle.endAt,
      transactions: plan.ledgerTransactions,
    });

  return buildAnalysSnapshot(
    {
      currency: plan.currency,
      timeZone,
      hasBankTruth: home?.hasBankTruth ?? plan.bankBalanceMinor != null,
      calculatedBalanceMinor:
        home?.calculatedBalanceMinor ?? plan.bankBalanceMinor,
      todaySpendingMinor:
        home?.todaySpendingMinor ?? windows.today.discretionary.amountMinor,
      monthSpendingMinor:
        home?.monthSpendingMinor ?? (plan.spendingByMonthKey[monthKey] ?? 0),
      cycleSpendingMinor:
        home?.cycleSpendingMinor ?? windows.cycle.total.amountMinor,
      fundingConfirmed,
      planItems: plan.items ?? [],
      spendingByMonthKey: plan.spendingByMonthKey ?? {},
      ledgerTransactions: plan.ledgerTransactions ?? [],
      fxMap,
      financeRevision: plan.financeRevision,
      verifiedAt: plan.verifiedAt,
      truthStatus: plan.truthStatus,
    },
    now,
  );
}
