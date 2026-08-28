import {
  cumulativePlanSavingsMinor,
  planWealthTotalMinor,
  projectCashCoverage,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import type { AnalysSnapshot } from "@/features/finance/load-analys";
import type { AccountsSnapshot } from "@/features/finance/load-accounts";
import type { HomeSnapshot } from "@/features/finance/load-home";
import type { MovementsSnapshot } from "@/features/finance/load-movements";
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
let movementsView: { filter: MovementsFilter; period: MovementsPeriod } | null =
  null;
let accounts: AccountsSnapshot | null = null;
let mer: MerSnapshot | null = null;
let fota: FotaBootSnapshot | null = null;
let importera: ImporteraRow[] | null = null;
let settings: SettingsSnapshot | null = null;

const homeListeners = new Set<() => void>();
const planListeners = new Set<() => void>();
const gettingStartedListeners = new Set<() => void>();

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

export function rememberMovementsSnapshot(snap: MovementsSnapshot) {
  movements = snap;
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

export function rememberAccountsSnapshot(snap: AccountsSnapshot) {
  accounts = snap;
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
