import { chromeDisplayName } from "@/domain/identity/display-name";
import {
  computeClassifiedSpendingWindows,
  resolveTodaySpendSplit,
  cumulativePlanSavingsMinor,
  hasCycleFundingEvidence,
  isSameZonedDay,
  monthKeyFromDate,
  perDayBudgetMinor,
  planWealthTotalMinor,
  projectCashCoverage,
  projectLivingBudget,
  projectPayCycle,
  remainingTodayOf,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import type { AnalysSnapshot } from "@/features/finance/load-analys";
import type { AccountsSnapshot } from "@/features/finance/load-accounts";
import type { HomeSnapshot } from "@/features/finance/load-home";
import type {
  MovementRow,
  MovementsSnapshot,
} from "@/features/finance/load-movements";
import type { PlanSnapshot } from "@/features/finance/load-plan";
import type { GettingStartedView } from "@/features/getting-started/progress";
import { stampPlanItems } from "@/features/plan/optimistic";

export type { PlanSnapshot } from "@/features/finance/load-plan";

export type MovementsFilter = "all" | "expense" | "income" | "other";
export type MovementsPeriod = "month" | "all";

export type MerSnapshot = {
  userId: string;
  displayName: string | null;
  isAdmin: boolean;
};

export type FotaBootSnapshot = {
  accountId: string | null;
  accounts: Array<{
    id: string;
    name: string;
    accountType: string;
    currency?: string;
  }>;
  remainingTodayMinor: number;
  currency: CurrencyCode;
  bootstrapping: boolean;
};

export type ImporteraRow = {
  id: string;
  kind: string;
  status: string;
  createdAt: string;
  notes: string | null;
};

export type SettingsSnapshot = {
  userId: string;
  displayName: string | null;
  timezone: string;
  primaryCurrency: string;
  supabaseReady: boolean;
  isAdmin: boolean;
};

let sessionOwnerId: string | null = null;
let home: HomeSnapshot | null = null;
let homeDirty = false;
let analys: AnalysSnapshot | null = null;
let plan: PlanSnapshot | null = null;
let planView: { monthKey: string; viewYear: number } | null = null;
let analysScope: "period" | "month" | null = null;
let gettingStarted: GettingStartedView | null = null;
let movements: MovementsSnapshot | null = null;
let movementsDirty = false;
let movementsView: { filter: MovementsFilter; period: MovementsPeriod } | null =
  null;
let accounts: AccountsSnapshot | null = null;
let accountsDirty = false;
let mer: MerSnapshot | null = null;
let fota: FotaBootSnapshot | null = null;
let importera: ImporteraRow[] | null = null;
let settings: SettingsSnapshot | null = null;

const homeListeners = new Set<() => void>();
const planListeners = new Set<() => void>();
const gettingStartedListeners = new Set<() => void>();
const movementsListeners = new Set<() => void>();
const accountsListeners = new Set<() => void>();
const planViewListeners = new Set<() => void>();

function emit(listeners: Set<() => void>) {
  for (const listener of listeners) listener();
}

export function subscribeHomeSnapshot(listener: () => void) {
  homeListeners.add(listener);
  return () => {
    homeListeners.delete(listener);
  };
}

export function subscribePlanSnapshot(listener: () => void) {
  planListeners.add(listener);
  return () => {
    planListeners.delete(listener);
  };
}

export function subscribeGettingStarted(listener: () => void) {
  gettingStartedListeners.add(listener);
  return () => {
    gettingStartedListeners.delete(listener);
  };
}

export function subscribeMovementsSnapshot(listener: () => void) {
  movementsListeners.add(listener);
  return () => {
    movementsListeners.delete(listener);
  };
}

export function subscribeAccountsSnapshot(listener: () => void) {
  accountsListeners.add(listener);
  return () => {
    accountsListeners.delete(listener);
  };
}

function wipeSessionCaches() {
  home = null;
  homeDirty = false;
  analys = null;
  plan = null;
  planView = null;
  analysScope = null;
  gettingStarted = null;
  movements = null;
  movementsDirty = false;
  movementsView = null;
  accounts = null;
  accountsDirty = false;
  mer = null;
  fota = null;
  importera = null;
  settings = null;
  emit(homeListeners);
  emit(planListeners);
  emit(gettingStartedListeners);
  emit(movementsListeners);
  emit(accountsListeners);
  emit(planViewListeners);
}

export function bindSessionOwner(userId: string) {
  if (sessionOwnerId && sessionOwnerId !== userId) {
    wipeSessionCaches();
  }
  sessionOwnerId = userId;
}

export function clearClientSessionCaches() {
  wipeSessionCaches();
  sessionOwnerId = null;
}

export function hasBoundSessionOwner(): boolean {
  return sessionOwnerId != null;
}

export function lastKnownChromeDisplayName(): string | null {
  if (!sessionOwnerId) return null;
  return chromeDisplayName(
    home?.displayName ?? mer?.displayName ?? settings?.displayName ?? null,
  );
}

export function isHomeDirty(): boolean {
  return homeDirty;
}


function financeRevisionOf(
  snap: { financeRevision?: string; verifiedAt?: string } | null,
): string {
  return snap?.financeRevision ?? "";
}

/** Adopt server money snapshots only when revision is newer or equal and not dirty. */
function shouldAdoptFinanceSnapshot(
  current: { financeRevision?: string; verifiedAt?: string } | null,
  incoming: { financeRevision?: string; verifiedAt?: string },
  dirty: boolean,
): boolean {
  if (!current) return true;
  const curRev = financeRevisionOf(current);
  const nextRev = financeRevisionOf(incoming);
  const curAt = current.verifiedAt ?? "";
  const nextAt = incoming.verifiedAt ?? "";

  if (dirty) {
    // Optimistic in flight: ignore same-revision RSC echoes; accept newer truth.
    if (!nextRev || nextRev === curRev) return false;
    if (curAt && nextAt && nextAt < curAt) return false;
    return true;
  }

  // Clean client: adopt unless the payload is an older revision than we show.
  if (
    curRev &&
    nextRev &&
    curRev !== nextRev &&
    curAt &&
    nextAt &&
    nextAt < curAt
  ) {
    return false;
  }
  return true;
}

export function rememberHomeSnapshot(
  snap: HomeSnapshot,
  opts?: { dirty?: boolean; force?: boolean },
) {
  bindSessionOwner(snap.userId);
  const nextDirty = opts?.dirty ?? false;
  if (home === snap && homeDirty === nextDirty) return;
  if (
    !nextDirty &&
    !opts?.force &&
    home &&
    !shouldAdoptFinanceSnapshot(home, snap, homeDirty)
  ) {
    return;
  }
  home = nextDirty
    ? {
        ...snap,
        verifiedAt: new Date().toISOString(),
        truthStatus: snap.truthStatus === "unavailable" ? "unavailable" : "stale",
      }
    : snap;
  homeDirty = nextDirty;
  emit(homeListeners);
}

export function lastHomeSnapshot(): HomeSnapshot | null {
  return home;
}

export function applyOptimisticHomeSpend(amountMinor: number): HomeSnapshot | null {
  if (!home || amountMinor === 0) return home;
  const previous = home;
  const calculatedBalanceMinor =
    previous.calculatedBalanceMinor == null
      ? null
      : previous.calculatedBalanceMinor - amountMinor;
  const overMinor =
    (calculatedBalanceMinor ?? 0) + previous.incomingMinor - previous.unpaidMinor;
  rememberHomeSnapshot(
    {
      ...previous,
      todaySpendingMinor: previous.todaySpendingMinor + amountMinor,
      remainingTodayMinor: previous.remainingTodayMinor - amountMinor,
      cycleSpendingMinor: previous.cycleSpendingMinor + amountMinor,
      monthSpendingMinor: previous.monthSpendingMinor + amountMinor,
      remainingFreeMinor: previous.remainingFreeMinor - amountMinor,
      safeToSpendTodayMinor: previous.safeToSpendTodayMinor - amountMinor,
      calculatedBalanceMinor,
      overMinor,
      wealthTotalMinor: planWealthTotalMinor(overMinor, previous.savingsTotalMinor),
    },
    { dirty: true },
  );
  return home;
}

export function revertOptimisticHomeSpend(amountMinor: number): HomeSnapshot | null {
  const next = applyOptimisticHomeSpend(-amountMinor);
  homeDirty = false;
  return next;
}

/** Server confirmed — drop optimistic lock so tabs adopt the next RSC payload. */
export function confirmOptimisticFinance() {
  homeDirty = false;
  movementsDirty = false;
  accountsDirty = false;
  analys = null;
  if (home && home.truthStatus === "stale") {
    rememberHomeSnapshot({ ...home, truthStatus: "verified" });
  }
}

/** Mutation result is the canonical revision — never lose it to a stale RSC echo. */
export function adoptMutationFinance(result: {
  home?: HomeSnapshot | null;
  plan?: PlanSnapshot | null;
  accounts?: AccountsSnapshot | null;
}) {
  if (result.home) rememberHomeSnapshot(result.home, { force: true });
  if (result.plan) rememberPlanSnapshot(result.plan);
  if (result.accounts) rememberAccountsSnapshot(result.accounts);
  confirmOptimisticFinance();
}

/** Drop Analys cache when money truth moves — next visit refetches shared revision. */
export function invalidateAnalysSnapshot() {
  analys = null;
}

/**
 * Recompute Hem living-budget + coverage from Plan truth.
 * Runs even while homeDirty so settle/expense optimistic paths stay coherent.
 */
export function syncHomeLivingFromPlan(snapshot: PlanSnapshot) {
  if (!home) return;
  const homeRev = home.financeRevision ?? "";
  const planRev = snapshot.financeRevision ?? "";
  const planIsLocal = planRev.endsWith(":local");
  if (
    home.verifiedAt &&
    snapshot.verifiedAt &&
    homeRev &&
    planRev &&
    !planIsLocal &&
    planRev !== homeRev &&
    snapshot.verifiedAt < home.verifiedAt
  ) {
    return;
  }
  const now = new Date();
  const timeZone = snapshot.timeZone;
  const cycle = projectPayCycle(snapshot.items, now, timeZone);
  const windows = computeClassifiedSpendingWindows({
    transactions: snapshot.ledgerTransactions,
    currency: snapshot.currency,
    now,
    timeZone,
    cycleStartAt: cycle.startAt,
    cycleEndAt: cycle.endAt,
  });
  const ledgerCycleMinor = windows.cycle.total.amountMinor;
  const cycleSpendingMinor = homeDirty
    ? Math.max(home.cycleSpendingMinor, ledgerCycleMinor)
    : ledgerCycleMinor;
  const todaySplit = resolveTodaySpendSplit({
    ledgerDiscretionaryMinor: windows.today.discretionary.amountMinor,
    ledgerPlannedPaidMinor: windows.today.plannedPaid.amountMinor,
    ledgerTotalMinor: windows.today.total.amountMinor,
    homeDiscretionaryMinor: home.todaySpendingMinor ?? 0,
    homePlannedPaidMinor: home.todayPlannedPaidMinor ?? 0,
    homeDirty,
  });
  // Plan ledger must never raise Spenderat idag. A settle row that lost
  // origin/link fields classifies as lunch and produced 21 200 here.
  const todaySpendingMinor = home.todaySpendingMinor ?? 0;
  const todayPlannedPaidMinor = Math.max(
    home.todayPlannedPaidMinor ?? 0,
    todaySplit.plannedPaidMinor,
  );
  const bankBalanceMinor = homeDirty
    ? home.calculatedBalanceMinor
    : (snapshot.bankBalanceMinor ?? home.calculatedBalanceMinor);
  const fundingConfirmed =
    home.cycleIsActive ||
    hasCycleFundingEvidence({
      cycleStartAt: cycle.startAt,
      cycleEndAt: cycle.endAt,
      transactions: snapshot.ledgerTransactions,
    });
  const living = projectLivingBudget({
    cycle,
    now,
    timeZone,
    bankBalanceMinor,
    cycleSpendingMinor,
    todaySpendingMinor,
    fundingConfirmed,
  });
  const coverage = projectCashCoverage({
    planItems: snapshot.items,
    transactions: snapshot.ledgerTransactions,
    monthKey: home.monthKey,
    timeZone,
    saldoMinor: bankBalanceMinor,
  });
  const savingsTotalMinor = cumulativePlanSavingsMinor(
    snapshot.items,
    home.monthKey,
    timeZone,
  );
  rememberHomeSnapshot(
    {
      ...home,
      calculatedBalanceMinor: bankBalanceMinor,
      todaySpendingMinor,
      todayPlannedPaidMinor,
      cycleSpendingMinor,
      safeToSpendTodayMinor: living.remainingTodayMinor,
      cycleStartLabelSv: cycle.startLabelSv,
      cycleEndLabelSv: living.cycleEndLabelSv,
      cycleEndInferred: living.cycleEndInferred,
      cycleIsActive: cycle.isActive && fundingConfirmed,
      livingMode: living.mode,
      needsAvailableInput: living.needsAvailableInput,
      usesBankBalance: living.usesBankBalance,
      planIncomeMinor: cycle.incomeMinor,
      planExpenseMinor: cycle.expenseMinor,
      planSavingsMinor: cycle.savingsMinor,
      freeToSpendMinor: cycle.freeToSpendMinor,
      remainingFreeMinor: living.remainingFreeMinor,
      spendDaysLeft: living.daysUntilHorizon,
      dayBudgetMinor: living.dayBudgetMinor,
      remainingTodayMinor: living.remainingTodayMinor,
      daysUntilIncome: living.daysUntilHorizon,
      nextIncomeLabelSv: living.nextIncomeLabelSv,
      incomingMinor: coverage.incomingMinor,
      unpaidMinor: coverage.unpaidMinor,
      overMinor: coverage.overMinor,
      savingsTotalMinor,
      wealthTotalMinor: planWealthTotalMinor(
        coverage.overMinor,
        savingsTotalMinor,
      ),
    },
    { dirty: homeDirty },
  );
}

/** @deprecated use syncHomeLivingFromPlan */
export function syncHomeCoverageFromPlan(snapshot: PlanSnapshot) {
  syncHomeLivingFromPlan(snapshot);
}

export function rememberAnalysSnapshot(snap: AnalysSnapshot) {
  if (analys === snap) return;
  if (analys && !shouldAdoptFinanceSnapshot(analys, snap, false)) {
    return;
  }
  analys = snap;
}

export function lastAnalysSnapshot(): AnalysSnapshot | null {
  return analys;
}

function planStamp(snapshot: PlanSnapshot): string {
  return `${stampPlanItems(snapshot.items)}:${snapshot.bankBalanceMinor}:${snapshot.ledgerTransactions.length}:${snapshot.currency}:${snapshot.timeZone}`;
}

export function rememberPlanSnapshot(snapshot: PlanSnapshot) {
  if (plan === snapshot) return;
  if (plan && !shouldAdoptFinanceSnapshot(plan, snapshot, false)) {
    return;
  }
  if (plan && planStamp(plan) === planStamp(snapshot)) {
    plan = snapshot;
    return;
  }
  const prevRev = plan?.financeRevision;
  plan = snapshot;
  // Drop Analys cache when Plan truth moved — forces shared revision on next load.
  if (
    analys &&
    snapshot.financeRevision &&
    analys.financeRevision !== snapshot.financeRevision
  ) {
    analys = null;
  } else if (prevRev && snapshot.financeRevision && prevRev !== snapshot.financeRevision) {
    analys = null;
  }
  emit(planListeners);
}

export function lastPlanSnapshot(): PlanSnapshot | null {
  return plan;
}

/**
 * The month Plan and Analys are both looking at.
 *
 * Notifies subscribers so a screen that is already mounted follows along —
 * tabs stay mounted between visits, so reading this only at mount time would
 * leave whichever screen you opened first showing a stale month.
 */
export function rememberPlanView(view: { monthKey: string; viewYear: number }) {
  if (
    planView &&
    planView.monthKey === view.monthKey &&
    planView.viewYear === view.viewYear
  ) {
    return;
  }
  planView = view;
  emit(planViewListeners);
}

export function subscribePlanView(listener: () => void) {
  planViewListeners.add(listener);
  return () => {
    planViewListeners.delete(listener);
  };
}

export function lastPlanView(): { monthKey: string; viewYear: number } | null {
  return planView;
}

export function rememberAnalysScope(scope: "period" | "month") {
  analysScope = scope;
}

export function lastAnalysScope(): "period" | "month" | null {
  return analysScope;
}

export function rememberGettingStarted(view: GettingStartedView | null) {
  if (gettingStarted === view) return;
  gettingStarted = view;
  emit(gettingStartedListeners);
}

export function lastGettingStarted(): GettingStartedView | null {
  return gettingStarted;
}

export function isMovementsDirty(): boolean {
  return movementsDirty;
}

export function rememberMovementsSnapshot(
  snap: MovementsSnapshot,
  opts?: { dirty?: boolean },
) {
  const nextDirty = opts?.dirty ?? false;
  if (movements === snap && movementsDirty === nextDirty) return;
  movements = snap;
  movementsDirty = nextDirty;
  emit(movementsListeners);
}

export function lastMovementsSnapshot(): MovementsSnapshot | null {
  return movements;
}

export function rememberMovementsView(view: {
  filter: MovementsFilter;
  period: MovementsPeriod;
}) {
  movementsView = view;
}

export function lastMovementsView(): {
  filter: MovementsFilter;
  period: MovementsPeriod;
} | null {
  return movementsView;
}

export function isAccountsDirty(): boolean {
  return accountsDirty;
}

export function rememberAccountsSnapshot(
  snap: AccountsSnapshot,
  opts?: { dirty?: boolean },
) {
  const nextDirty = opts?.dirty ?? false;
  if (accounts === snap && accountsDirty === nextDirty) return;
  accounts = snap;
  accountsDirty = nextDirty;
  emit(accountsListeners);
}

export function lastAccountsSnapshot(): AccountsSnapshot | null {
  return accounts;
}

export function rememberMerSnapshot(snap: MerSnapshot) {
  bindSessionOwner(snap.userId);
  mer = snap;
}

export function lastMerSnapshot(): MerSnapshot | null {
  return mer;
}

export function rememberFotaBoot(snap: FotaBootSnapshot) {
  fota = snap;
}

export function lastFotaBoot(): FotaBootSnapshot | null {
  return fota;
}

export function rememberImporteraRows(rows: ImporteraRow[]) {
  importera = rows;
}

export function lastImporteraRows(): ImporteraRow[] | null {
  return importera;
}

export function rememberSettingsSnapshot(snap: SettingsSnapshot) {
  bindSessionOwner(snap.userId);
  settings = snap;
}

export function lastSettingsSnapshot(): SettingsSnapshot | null {
  return settings;
}

function movementBalanceDelta(
  tx: Pick<MovementRow, "transactionType" | "direction" | "amountMinor">,
): number {
  if (tx.direction === "credit" || tx.transactionType === "income") {
    return tx.amountMinor;
  }
  if (tx.direction === "debit" || tx.transactionType === "expense") {
    return -tx.amountMinor;
  }
  return 0;
}

function recomputeMovements(
  previous: MovementsSnapshot,
  items: MovementRow[],
  balanceDelta: number,
): MovementsSnapshot {
  let monthIncomeMinor = 0;
  let monthExpenseMinor = 0;
  let allIncomeMinor = 0;
  let allExpenseMinor = 0;
  const categoryMap = new Map<
    string,
    { name: string; amountMinor: number; count: number }
  >();

  for (const tx of items) {
    const inMonth =
      monthKeyFromDate(new Date(tx.occurredAt), previous.timeZone) ===
      previous.monthKey;
    if (tx.transactionType === "expense") {
      allExpenseMinor += tx.amountMinor;
      if (inMonth) {
        monthExpenseMinor += tx.amountMinor;
        const name = tx.category?.trim() || "Övrigt";
        const prev = categoryMap.get(name) ?? {
          name,
          amountMinor: 0,
          count: 0,
        };
        prev.amountMinor += tx.amountMinor;
        prev.count += 1;
        categoryMap.set(name, prev);
      }
    } else if (tx.transactionType === "income") {
      allIncomeMinor += tx.amountMinor;
      if (inMonth) monthIncomeMinor += tx.amountMinor;
    }
  }

  return {
    ...previous,
    items,
    monthIncomeMinor,
    monthExpenseMinor,
    monthNetMinor: monthIncomeMinor - monthExpenseMinor,
    allIncomeMinor,
    allExpenseMinor,
    allNetMinor: allIncomeMinor - allExpenseMinor,
    monthCategories: [...categoryMap.values()].sort(
      (a, b) => b.amountMinor - a.amountMinor,
    ),
    balanceMinor:
      previous.balanceMinor == null
        ? null
        : previous.balanceMinor + balanceDelta,
  };
}

function applyHomeForExpenseDelta(item: MovementRow, amountDelta: number) {
  const timeZone = home?.timeZone ?? movements?.timeZone ?? "Asia/Bangkok";
  if (isSameZonedDay(item.occurredAt, new Date(), timeZone)) {
    applyOptimisticHomeSpend(amountDelta);
    return;
  }
  applyOptimisticHomeIncome(-amountDelta);
}

/** Mottagen / Betald: move saldo and drop the matching pile so Över stays still. */
export function applyOptimisticPlanSettle(input: {
  saldoDeltaMinor: number;
  incomingDeltaMinor: number;
  unpaidDeltaMinor: number;
  /** Expense settle booked to ledger — counts once in cycle spend, not flexible twice. */
  cycleSpendingDeltaMinor?: number;
  /** Planned-bill payments booked today — never the discretionary day envelope. */
  todayPlannedPaidDeltaMinor?: number;
}): HomeSnapshot | null {
  if (
    !home ||
    (input.saldoDeltaMinor === 0 &&
      input.incomingDeltaMinor === 0 &&
      input.unpaidDeltaMinor === 0 &&
      (input.cycleSpendingDeltaMinor ?? 0) === 0 &&
      (input.todayPlannedPaidDeltaMinor ?? 0) === 0)
  ) {
    return home;
  }
  const previous = home;
  const calculatedBalanceMinor =
    previous.calculatedBalanceMinor == null
      ? null
      : previous.calculatedBalanceMinor + input.saldoDeltaMinor;
  const incomingMinor = Math.max(
    0,
    previous.incomingMinor + input.incomingDeltaMinor,
  );
  const unpaidMinor = Math.max(0, previous.unpaidMinor + input.unpaidDeltaMinor);
  const cycleSpendingMinor =
    previous.cycleSpendingMinor + (input.cycleSpendingDeltaMinor ?? 0);
  const overMinor =
    (calculatedBalanceMinor ?? 0) + incomingMinor - unpaidMinor;
  const planSnap = lastPlanSnapshot();
  let remainingFreeMinor = previous.remainingFreeMinor;
  let freeToSpendMinor = previous.freeToSpendMinor;
  let planExpenseMinor = previous.planExpenseMinor;
  let dayBudgetMinor = previous.dayBudgetMinor;
  let remainingTodayMinor = previous.remainingTodayMinor;
  if (planSnap) {
    const now = new Date();
    const cycle = projectPayCycle(planSnap.items, now, planSnap.timeZone);
    if (cycle.isActive || previous.cycleIsActive) {
      const living = projectLivingBudget({
        cycle,
        now,
        timeZone: planSnap.timeZone,
        bankBalanceMinor: calculatedBalanceMinor,
        cycleSpendingMinor,
        todaySpendingMinor: previous.todaySpendingMinor,
        fundingConfirmed: previous.cycleIsActive || cycle.isActive,
      });
      remainingFreeMinor = living.remainingFreeMinor;
      freeToSpendMinor = cycle.freeToSpendMinor;
      planExpenseMinor = cycle.expenseMinor;
      dayBudgetMinor = living.dayBudgetMinor;
      remainingTodayMinor = living.remainingTodayMinor;
    }
  }
  rememberHomeSnapshot(
    {
      ...previous,
      calculatedBalanceMinor,
      incomingMinor,
      unpaidMinor,
      overMinor,
      cycleSpendingMinor,
      todayPlannedPaidMinor:
        previous.todayPlannedPaidMinor + (input.todayPlannedPaidDeltaMinor ?? 0),
      remainingFreeMinor,
      freeToSpendMinor,
      planExpenseMinor,
      dayBudgetMinor,
      remainingTodayMinor,
      safeToSpendTodayMinor: remainingTodayMinor,
      wealthTotalMinor: planWealthTotalMinor(
        overMinor,
        previous.savingsTotalMinor,
      ),
    },
    { dirty: true },
  );
  invalidateAnalysSnapshot();
  return home;
}

export function applyOptimisticHomeIncome(
  amountMinor: number,
): HomeSnapshot | null {
  if (!home || amountMinor === 0) return home;
  const previous = home;
  const calculatedBalanceMinor =
    previous.calculatedBalanceMinor == null
      ? null
      : previous.calculatedBalanceMinor + amountMinor;
  const overMinor =
    (calculatedBalanceMinor ?? 0) +
    previous.incomingMinor -
    previous.unpaidMinor;
  rememberHomeSnapshot(
    {
      ...previous,
      calculatedBalanceMinor,
      overMinor,
      wealthTotalMinor: planWealthTotalMinor(
        overMinor,
        previous.savingsTotalMinor,
      ),
    },
    { dirty: true },
  );
  return home;
}

export function applyHomeBankBalance(balanceMinor: number): HomeSnapshot | null {
  if (!home) return null;
  const overMinor = balanceMinor + home.incomingMinor - home.unpaidMinor;
  const spentToday = Math.max(0, home.todaySpendingMinor);
  const refreshDayEnvelope =
    home.livingMode !== "cycle" &&
    (home.needsAvailableInput ||
      home.livingMode === "bridge" ||
      home.usesBankBalance);
  const dayBudgetMinor = refreshDayEnvelope
    ? perDayBudgetMinor(Math.max(0, balanceMinor + spentToday), Math.max(1, home.spendDaysLeft))
    : home.dayBudgetMinor;
  const remainingTodayMinor = refreshDayEnvelope
    ? remainingTodayOf(dayBudgetMinor, spentToday)
    : home.remainingTodayMinor;
  rememberHomeSnapshot(
    {
      ...home,
      calculatedBalanceMinor: balanceMinor,
      hasBankTruth: true,
      overMinor,
      wealthTotalMinor: planWealthTotalMinor(overMinor, home.savingsTotalMinor),
      ...(refreshDayEnvelope
        ? {
            needsAvailableInput: false,
            usesBankBalance: true,
            dayBudgetMinor,
            remainingTodayMinor,
            safeToSpendTodayMinor: remainingTodayMinor,
          }
        : {}),
    },
    { dirty: true },
  );
  return home;
}

/** Accounts list only — Hem saldo is updated by spend/income/checkpoint helpers. */
export function applyAccountDelta(
  deltaMinor: number,
  accountId?: string | null,
): AccountsSnapshot | null {
  if (!accounts || deltaMinor === 0) return accounts;
  const target =
    (accountId
      ? accounts.accounts.find((row) => row.id === accountId)
      : null) ??
    accounts.accounts.find((row) => row.isDefault) ??
    accounts.accounts[0];
  if (!target || target.calculatedMinor == null) return accounts;
  const nextCalculated = target.calculatedMinor + deltaMinor;
  const nextThb =
    target.currency === "THB"
      ? nextCalculated
      : target.thbMinor != null && target.fxRate != null
        ? Math.round(nextCalculated * target.fxRate)
        : target.thbMinor;
  const nextAccounts = accounts.accounts.map((row) =>
    row.id === target.id
      ? { ...row, calculatedMinor: nextCalculated, thbMinor: nextThb }
      : row,
  );
  let totalThbMinor: number | null = null;
  for (const row of nextAccounts) {
    const thb =
      row.thbMinor ?? (row.currency === "THB" ? row.calculatedMinor : null);
    if (thb == null) continue;
    totalThbMinor = (totalThbMinor ?? 0) + thb;
  }
  rememberAccountsSnapshot(
    { accounts: nextAccounts, totalThbMinor },
    { dirty: true },
  );
  return accounts;
}

export function applyAccountBalance(
  accountId: string,
  balanceMinor: number,
  options?: {
    thbMinor?: number;
    currency?: import("@/domain/money").CurrencyCode;
  },
): AccountsSnapshot | null {
  const currency = options?.currency;

  let totalThbMinor: number | null = null;
  let appliedThb: number | null = null;

  if (accounts) {
    const found = accounts.accounts.some((row) => row.id === accountId);
    if (!found) {
      const fallbackCurrency = currency ?? "THB";
      appliedThb =
        options?.thbMinor ??
        (fallbackCurrency === "THB" ? balanceMinor : null);
      if (appliedThb != null) applyHomeBankBalance(appliedThb);
    } else {
      const nextAccounts = accounts.accounts.map((row) => {
        if (row.id !== accountId) return row;
        const nextCurrency = currency ?? row.currency;
        const thbMinor =
          options?.thbMinor ??
          (nextCurrency === "THB"
            ? balanceMinor
            : row.fxRate != null && row.fxRate > 0
              ? Math.round(balanceMinor * row.fxRate)
              : null);
        return {
          ...row,
          calculatedMinor: balanceMinor,
          thbMinor,
          currency: nextCurrency,
        };
      });
      for (const row of nextAccounts) {
        const thb =
          row.thbMinor ??
          (row.currency === "THB" ? row.calculatedMinor : null);
        if (thb == null) continue;
        totalThbMinor = (totalThbMinor ?? 0) + thb;
      }
      rememberAccountsSnapshot(
        { accounts: nextAccounts, totalThbMinor },
        { dirty: true },
      );
      appliedThb = totalThbMinor;
      if (totalThbMinor != null) {
        applyHomeBankBalance(totalThbMinor);
      }
    }
  } else {
    const fallbackCurrency = currency ?? "THB";
    appliedThb =
      options?.thbMinor ??
      (fallbackCurrency === "THB" ? balanceMinor : null);
    if (appliedThb != null) applyHomeBankBalance(appliedThb);
  }

  if (movements && appliedThb != null) {
    rememberMovementsSnapshot(
      { ...movements, balanceMinor: appliedThb, hasBankTruth: true },
      { dirty: true },
    );
  }
  return accounts;
}

export function applyMovementsAdd(row: MovementRow): MovementsSnapshot | null {
  if (!movements) return null;
  if (movements.items.some((tx) => tx.id === row.id)) return movements;
  rememberMovementsSnapshot(
    recomputeMovements(
      movements,
      [row, ...movements.items],
      movementBalanceDelta(row),
    ),
    { dirty: true },
  );
  return movements;
}

export function applyMovementsVoid(id: string): MovementsSnapshot | null {
  if (!movements) return null;
  const item = movements.items.find((tx) => tx.id === id);
  if (!item) return movements;
  rememberMovementsSnapshot(
    recomputeMovements(
      movements,
      movements.items.filter((tx) => tx.id !== id),
      -movementBalanceDelta(item),
    ),
    { dirty: true },
  );
  applyAccountDelta(-movementBalanceDelta(item));
  if (item.transactionType === "expense") {
    applyHomeForExpenseDelta(item, -item.amountMinor);
  } else if (item.transactionType === "income") {
    applyOptimisticHomeIncome(-item.amountMinor);
  }
  return movements;
}

export function applyMovementsEdit(
  id: string,
  patch: {
    amountMinor: number;
    description: string;
    category?: string | null;
  },
): MovementsSnapshot | null {
  if (!movements) return null;
  const item = movements.items.find((tx) => tx.id === id);
  if (!item) return movements;
  const nextItem: MovementRow = {
    ...item,
    amountMinor: patch.amountMinor,
    description: patch.description,
    category: patch.category === undefined ? item.category : patch.category,
  };
  const balanceDelta =
    movementBalanceDelta(nextItem) - movementBalanceDelta(item);
  rememberMovementsSnapshot(
    recomputeMovements(
      movements,
      movements.items.map((tx) => (tx.id === id ? nextItem : tx)),
      balanceDelta,
    ),
    { dirty: true },
  );
  applyAccountDelta(balanceDelta);
  if (item.transactionType === "expense") {
    applyHomeForExpenseDelta(item, nextItem.amountMinor - item.amountMinor);
  } else if (item.transactionType === "income") {
    applyOptimisticHomeIncome(nextItem.amountMinor - item.amountMinor);
  }
  return movements;
}

export function applyLocalExpense(input: {
  id?: string;
  amountMinor: number;
  description: string;
  category?: string | null;
  currency: CurrencyCode;
  accountId?: string | null;
}) {
  applyOptimisticHomeSpend(input.amountMinor);
  applyAccountDelta(-input.amountMinor, input.accountId);
  applyMovementsAdd({
    id: input.id ?? crypto.randomUUID(),
    description: input.description,
    category: input.category ?? null,
    transactionType: "expense",
    direction: "debit",
    amountMinor: input.amountMinor,
    currency: input.currency,
    occurredAt: new Date().toISOString(),
    source: "manual",
  });
}

export function applyLocalIncome(input: {
  id?: string;
  amountMinor: number;
  description: string;
  currency: CurrencyCode;
}) {
  applyOptimisticHomeIncome(input.amountMinor);
  applyAccountDelta(input.amountMinor);
  applyMovementsAdd({
    id: input.id ?? crypto.randomUUID(),
    description: input.description,
    category: null,
    transactionType: "income",
    direction: "credit",
    amountMinor: input.amountMinor,
    currency: input.currency,
    occurredAt: new Date().toISOString(),
    source: "manual",
  });
}

export function applyLocalTransfer(input: {
  fromAccountId: string;
  toAccountId: string;
  amountMinor: number;
}) {
  applyAccountDelta(-input.amountMinor, input.fromAccountId);
  applyAccountDelta(input.amountMinor, input.toAccountId);
  // Hem saldo is Σ THB. A same-currency move must not shrink or grow it.
  const total = accounts?.totalThbMinor;
  if (total != null) applyHomeBankBalance(total);
}
