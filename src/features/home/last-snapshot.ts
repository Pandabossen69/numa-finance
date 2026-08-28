import {
  cumulativePlanSavingsMinor,
  isSameZonedDay,
  monthKeyFromDate,
  planWealthTotalMinor,
  projectCashCoverage,
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
  displayName: string;
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
  displayName: string;
  timezone: string;
  primaryCurrency: string;
  supabaseReady: boolean;
  isAdmin: boolean;
};

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

export function isHomeDirty(): boolean {
  return homeDirty;
}

export function rememberHomeSnapshot(
  snap: HomeSnapshot,
  opts?: { dirty?: boolean },
) {
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

export function rememberPlanView(view: { monthKey: string; viewYear: number }) {
  planView = view;
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
  rememberHomeSnapshot(
    {
      ...home,
      calculatedBalanceMinor: balanceMinor,
      hasBankTruth: true,
      overMinor,
      wealthTotalMinor: planWealthTotalMinor(overMinor, home.savingsTotalMinor),
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
  rememberAccountsSnapshot(
    {
      accounts: accounts.accounts.map((row) =>
        row.id === target.id
          ? { ...row, calculatedMinor: row.calculatedMinor! + deltaMinor }
          : row,
      ),
    },
    { dirty: true },
  );
  return accounts;
}

export function applyAccountBalance(
  accountId: string,
  balanceMinor: number,
): AccountsSnapshot | null {
  if (accounts) {
    rememberAccountsSnapshot(
      {
        accounts: accounts.accounts.map((row) =>
          row.id === accountId ? { ...row, calculatedMinor: balanceMinor } : row,
        ),
      },
      { dirty: true },
    );
  }
  const row = accounts?.accounts.find((item) => item.id === accountId);
  if (!row || row.isDefault) {
    applyHomeBankBalance(balanceMinor);
  }
  if (movements) {
    rememberMovementsSnapshot(
      { ...movements, balanceMinor, hasBankTruth: true },
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
  const primaryId =
    accounts?.accounts.find((row) => row.isDefault)?.id ??
    home?.primaryAccountId ??
    null;
  if (primaryId === input.fromAccountId) {
    applyOptimisticHomeIncome(-input.amountMinor);
  } else if (primaryId === input.toAccountId) {
    applyOptimisticHomeIncome(input.amountMinor);
  }
}
