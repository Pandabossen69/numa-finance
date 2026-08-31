import { chromeDisplayName } from "@/domain/identity/display-name";
import {
  cumulativePlanSavingsMinor,
  isSameZonedDay,
  monthKeyFromDate,
  perDayBudgetMinor,
  planWealthTotalMinor,
  projectCashCoverage,
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

export function rememberHomeSnapshot(
  snap: HomeSnapshot,
  opts?: { dirty?: boolean },
) {
  bindSessionOwner(snap.userId);
  const nextDirty = opts?.dirty ?? false;
  if (home === snap && homeDirty === nextDirty) return;
  home = snap;
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

export function syncHomeCoverageFromPlan(snapshot: PlanSnapshot) {
  if (!home || homeDirty) return;
  const coverage = projectCashCoverage({
    planItems: snapshot.items,
    transactions: snapshot.ledgerTransactions,
    monthKey: home.monthKey,
    timeZone: snapshot.timeZone,
    saldoMinor: snapshot.bankBalanceMinor,
  });
  const savingsTotalMinor = cumulativePlanSavingsMinor(
    snapshot.items,
    home.monthKey,
    snapshot.timeZone,
  );
  rememberHomeSnapshot({
    ...home,
    calculatedBalanceMinor: snapshot.bankBalanceMinor,
    incomingMinor: coverage.incomingMinor,
    unpaidMinor: coverage.unpaidMinor,
    overMinor: coverage.overMinor,
    savingsTotalMinor,
    wealthTotalMinor: planWealthTotalMinor(coverage.overMinor, savingsTotalMinor),
  });
}

export function rememberAnalysSnapshot(snap: AnalysSnapshot) {
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
  if (plan && planStamp(plan) === planStamp(snapshot)) {
    plan = snapshot;
    return;
  }
  plan = snapshot;
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
}): HomeSnapshot | null {
  if (
    !home ||
    (input.saldoDeltaMinor === 0 &&
      input.incomingDeltaMinor === 0 &&
      input.unpaidDeltaMinor === 0)
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
  const overMinor =
    (calculatedBalanceMinor ?? 0) + incomingMinor - unpaidMinor;
  rememberHomeSnapshot(
    {
      ...previous,
      calculatedBalanceMinor,
      incomingMinor,
      unpaidMinor,
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
}) {
  applyOptimisticHomeSpend(input.amountMinor);
  applyAccountDelta(-input.amountMinor);
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
