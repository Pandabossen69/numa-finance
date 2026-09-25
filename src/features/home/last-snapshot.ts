import { chromeDisplayName } from "@/domain/identity/display-name";
import {
  applyLeftoverSparDelta,
  computeClassifiedSpendingWindows,
  resolveTodaySpendSplit,
  cashOverMinor,
  hasCycleFundingEvidence,
  isSameZonedDay,
  monthKeyFromDate,
  zonedDayKey,
  perDayBudgetMinor,
  planWealthTotalMinor,
  projectCashCoverage,
  projectLedgerToCanonicalThb,
  projectLivingBudget,
  projectPayCycle,
  remainingTodayOf,
  sortNewestFirst,
  sortSpendDesc,
  type FxCheckpoint,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import { analysSnapshotFromHome } from "@/features/finance/analys-from-known";
import type { AnalysSnapshot } from "@/features/finance/load-analys";
import type {
  AccountBalanceRow,
  AccountsSnapshot,
} from "@/features/finance/load-accounts";
import type { HomeSnapshot } from "@/features/finance/load-home";
import type {
  MovementRow,
  MovementsSnapshot,
} from "@/features/finance/load-movements";
import type { PlanSnapshot } from "@/features/finance/load-plan";
import type { GettingStartedView } from "@/features/getting-started/progress";
import { stampPlanItems } from "@/features/plan/optimistic";
import {
  readLastHomeCookieFromDocument,
  writeLastHomeCookie,
} from "@/features/home/last-home-cookie";
import {
  accountsLastKnownCanPaint,
  decideAccountsLastKnown,
} from "@/features/home/accounts-last-known";
import {
  clearPersistedLastKnown,
  readPersistedLastKnown,
  writePersistedLastKnown,
} from "@/features/home/last-snapshot-persist";

export type { PlanSnapshot } from "@/features/finance/load-plan";

export type MovementsFilter = "all" | "expense" | "income" | "other";
export type MovementsPeriod = "month" | "all";
export type MovementsView = {
  filter: MovementsFilter;
  period: MovementsPeriod;
  /** Per kategori tap — null means every category. */
  category?: string | null;
};

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

type LeftoverLivingBaseline = {
  saveMinor: number;
  monthKey: string;
  /** Bangkok civil day the leftover write was stashed (`YYYY-MM-DD`). */
  zonedDayKey: string;
  dayBudgetMinor: number;
  remainingTodayMinor: number;
  livingPoolMinor: number;
  remainingFreeMinor: number;
  spendDaysLeft: number;
  todaySpendingMinor: number;
};

let leftoverLivingBaseline: LeftoverLivingBaseline | null = null;

function leftoverSaveOf(snap: HomeSnapshot): number {
  return snap.planMonthSavingsMinor ?? 0;
}

function leftoverIncomingShape(snap: HomeSnapshot): boolean {
  const spent = Math.max(0, snap.todaySpendingMinor ?? 0);
  return (
    snap.remainingTodayMinor === snap.dayBudgetMinor ||
    snap.remainingTodayMinor === snap.dayBudgetMinor - spent
  );
}

function leftoverCivilDayNow(timeZone: string): string {
  return zonedDayKey(new Date(), timeZone);
}

/** True only while the leftover write is still the same Bangkok civil day. */
function leftoverBaselineMatchesCivilDay(timeZone: string): boolean {
  return (
    leftoverLivingBaseline != null &&
    leftoverLivingBaseline.zonedDayKey === leftoverCivilDayNow(timeZone)
  );
}

/**
 * Stash Spec O2 post-write leftover living (275,12 at 15k). Same Bangkok
 * day must not clobber with a daysLeft recompute (330,15). A new civil
 * day restashes so 1 650,75 / 5 can become today's envelope.
 */
function maybeRememberLeftoverLivingBaseline(
  snap: HomeSnapshot,
  opts?: { fromPersist?: boolean },
) {
  const save = leftoverSaveOf(snap);
  if (save <= 0 || snap.dayBudgetMinor <= 0) return;
  const todayKey = leftoverCivilDayNow(snap.timeZone);
  if (opts?.fromPersist && snap.verifiedAt) {
    if (zonedDayKey(snap.verifiedAt, snap.timeZone) !== todayKey) return;
  }
  if (
    leftoverLivingBaseline &&
    leftoverLivingBaseline.saveMinor === save &&
    leftoverLivingBaseline.monthKey === snap.monthKey &&
    leftoverLivingBaseline.zonedDayKey === todayKey &&
    snap.dayBudgetMinor > leftoverLivingBaseline.dayBudgetMinor
  ) {
    return;
  }
  leftoverLivingBaseline = {
    saveMinor: save,
    monthKey: snap.monthKey,
    zonedDayKey: todayKey,
    dayBudgetMinor: snap.dayBudgetMinor,
    remainingTodayMinor: snap.remainingTodayMinor,
    livingPoolMinor: snap.livingPoolMinor,
    remainingFreeMinor: snap.remainingFreeMinor,
    spendDaysLeft: snap.spendDaysLeft,
    todaySpendingMinor: snap.todaySpendingMinor ?? 0,
  };
}

/**
 * Server restore at 15k uses projectLivingBudget(now) — same Bangkok day
 * as the leftover write still overlays 330,15 → 275,12. After the civil
 * day rolls, 1 650,75 / 5 = 330,15 is today's envelope.
 */
function applyLeftoverLivingBaseline(incoming: HomeSnapshot): HomeSnapshot {
  if (incoming.planMonthSavingsMinor === 0) {
    leftoverLivingBaseline = null;
    return incoming;
  }
  const baseline = leftoverLivingBaseline;
  if (!baseline) return incoming;
  // Spec Q: leftover 275,12 is a same-day overlay only. After the Bangkok
  // civil day rolls, 1 650,75 / 5 = 330,15 is today's envelope.
  if (!leftoverBaselineMatchesCivilDay(incoming.timeZone)) {
    return incoming;
  }
  const incomingSave = leftoverSaveOf(incoming);
  if (incomingSave <= 0 || incomingSave > baseline.saveMinor) return incoming;
  if (incoming.monthKey && incoming.monthKey !== baseline.monthKey) {
    return incoming;
  }
  if (incoming.dayBudgetMinor <= baseline.dayBudgetMinor) return incoming;
  if (incoming.livingPoolMinor !== baseline.livingPoolMinor) return incoming;
  if (!leftoverIncomingShape(incoming)) return incoming;
  return {
    ...incoming,
    dayBudgetMinor: baseline.dayBudgetMinor,
    remainingTodayMinor: baseline.remainingTodayMinor,
    safeToSpendTodayMinor: baseline.remainingTodayMinor,
    livingPoolMinor: baseline.livingPoolMinor,
    remainingFreeMinor: baseline.remainingFreeMinor,
    spendDaysLeft: baseline.spendDaysLeft,
    daysUntilIncome: baseline.spendDaysLeft,
  };
}

let sessionOwnerId: string | null = null;
let home: HomeSnapshot | null = null;
/** True only after a live remember this JS lifetime — not hydrate/cookie. */
let homeSessionConfirmed = false;
let homeDirty = false;
let analys: AnalysSnapshot | null = null;
let plan: PlanSnapshot | null = null;
let planView: { monthKey: string; viewYear: number } | null = null;
let analysScope: "period" | "month" | null = null;
let gettingStarted: GettingStartedView | null = null;
let movements: MovementsSnapshot | null = null;
let movementsDirty = false;
let movementsView: MovementsView | null = null;
let accounts: AccountsSnapshot | null = null;
let accountsDirty = false;
/** Live remember this JS lifetime — hydrate/quiet-warm last-known stays gated. */
let accountsSessionConfirmed = false;
let mer: MerSnapshot | null = null;
let fota: FotaBootSnapshot | null = null;
let importera: ImporteraRow[] | null = null;
let settings: SettingsSnapshot | null = null;

const homeListeners = new Set<() => void>();
const planListeners = new Set<() => void>();
const analysListeners = new Set<() => void>();
const gettingStartedListeners = new Set<() => void>();
const movementsListeners = new Set<() => void>();
const accountsListeners = new Set<() => void>();
const merListeners = new Set<() => void>();
const planViewListeners = new Set<() => void>();
const movementsViewListeners = new Set<() => void>();

function emit(listeners: Set<() => void>) {
  for (const listener of listeners) listener();
  schedulePersist();
}

let persistPaused = false;
let persistQueued = false;

function schedulePersist() {
  if (persistPaused || persistQueued) return;
  persistQueued = true;
  queueMicrotask(() => {
    persistQueued = false;
    if (persistPaused) return;
    writePersistedLastKnown({
      v: 1,
      userId: sessionOwnerId,
      home,
      plan,
      analys,
      mer,
      accounts,
      movements,
      gettingStarted,
      planView,
      analysScope,
      movementsView,
    });
  });
}

export function hydrateLastKnownFromPersist() {
  const data = readPersistedLastKnown();
  persistPaused = true;
  homeSessionConfirmed = false;
  const cookieHome = readLastHomeCookieFromDocument();
  if (data) {
    sessionOwnerId = data.userId;
    const cookieMatchesOwner =
      cookieHome != null &&
      data.userId != null &&
      cookieHome.userId === data.userId;
    home = data.home ?? (cookieMatchesOwner ? cookieHome : null);
    plan = data.plan;
    analys = data.analys;
    mer = data.mer;
    accounts = data.accounts;
    accountsSessionConfirmed = false;
    if (
      accounts &&
      !accountsLastKnownCanPaint(accounts, {
        hemBalanceMinor:
          home?.calculatedBalanceMinor ?? plan?.bankBalanceMinor ?? null,
        fresherAccounts: plan?.accounts ?? null,
      })
    ) {
      accounts = null;
    }
    movements = data.movements;
    gettingStarted = data.gettingStarted;
    planView = data.planView;
    analysScope = data.analysScope;
    movementsView = data.movementsView;
    if (home) maybeRememberLeftoverLivingBaseline(home, { fromPersist: true });
    if (!analysLastKnownCanPaint(analys) && home) {
      // Hem-thin only — Plan ledger FX+windows must not run on hydrate.
      analys = analysSnapshotFromHome(home);
    }
    if (!mer && home) mer = merSnapshotFromHome(home);
    persistPaused = false;
    return;
  }
  if (cookieHome) {
    sessionOwnerId = cookieHome.userId;
    home = cookieHome;
    maybeRememberLeftoverLivingBaseline(cookieHome, { fromPersist: true });
    if (!analysLastKnownCanPaint(analys)) {
      analys = analysSnapshotFromHome(cookieHome);
    }
    if (!mer) mer = merSnapshotFromHome(cookieHome);
  }
  persistPaused = false;
}

hydrateLastKnownFromPersist();

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
  leftoverLivingBaseline = null;
  home = null;
  homeSessionConfirmed = false;
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
  accountsSessionConfirmed = false;
  mer = null;
  fota = null;
  importera = null;
  settings = null;
  emit(homeListeners);
  emit(planListeners);
  emit(gettingStartedListeners);
  emit(movementsListeners);
  emit(accountsListeners);
  emit(merListeners);
  emit(planViewListeners);
  emit(movementsViewListeners);
}

export function bindSessionOwner(userId: string) {
  const boundOwner =
    sessionOwnerId ?? home?.userId ?? mer?.userId ?? settings?.userId ?? null;
  if (boundOwner && boundOwner !== userId) {
    persistPaused = true;
    wipeSessionCaches();
    sessionOwnerId = userId;
    clearPersistedLastKnown();
    persistPaused = false;
    return;
  }
  sessionOwnerId = userId;
}

export function clearClientSessionCaches(options?: {
  keepHomeCookie?: boolean;
}) {
  // Pause persist so wipe's emit cannot rewrite the cookie to empty
  // before keepHomeCookie is applied (SPEC H same-user logout).
  persistPaused = true;
  wipeSessionCaches();
  sessionOwnerId = null;
  clearPersistedLastKnown({ keepHomeCookie: options?.keepHomeCookie === true });
  persistPaused = false;
}

/**
 * Drop Hem paint eligibility without wiping Plan/Analys caches.
 * Login / cold reopen must not flash a previous visit's kvar/Över.
 */
export function invalidateHomeSessionPaint() {
  if (!homeSessionConfirmed && home == null) return;
  homeSessionConfirmed = false;
  emit(homeListeners);
}

export function hasBoundSessionOwner(): boolean {
  return sessionOwnerId != null;
}

/** Hem money confirmed this JS session (fetch or mutation) — not hydrate. */
export function isHomeSessionConfirmed(): boolean {
  return homeSessionConfirmed;
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

  // :local optimistic snapshots stamp verifiedAt with the client clock.
  // When that clock is ahead of the server, timestamp order would refuse a
  // newer server revision. Server truth wins over :local when revisions differ.
  if (
    curRev.endsWith(":local") &&
    nextRev &&
    !nextRev.endsWith(":local") &&
    curRev !== nextRev
  ) {
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

/**
 * Fetch/sync leftover 275,12 must not undo a 15k→20k living adopt.
 * Only after a savings mutation (plan-month avsätt). Additive Plan warmup
 * that raises period spend (locked SEK) must still adopt.
 */
export function isLeftoverSparLivingRevert(
  current: HomeSnapshot,
  incoming: HomeSnapshot,
): boolean {
  const timeZone = incoming.timeZone || current.timeZone;
  if (leftoverLivingBaseline && !leftoverBaselineMatchesCivilDay(timeZone)) {
    return false;
  }
  // Hydrate of yesterday's leftover does not restash a today-keyed
  // baseline. A daysLeft roll (6→5) must still adopt 330,15.
  if (
    !leftoverBaselineMatchesCivilDay(timeZone) &&
    incoming.spendDaysLeft !== current.spendDaysLeft
  ) {
    return false;
  }
  const adoptedMonthSave = current.planMonthSavingsMinor ?? 0;
  const baselineSave = leftoverLivingBaseline?.saveMinor ?? 0;
  if (adoptedMonthSave <= 0 && baselineSave <= 0) return false;
  const currentSave =
    current.planMonthSavingsMinor ?? current.savingsTotalMinor;
  const incomingSave =
    incoming.planMonthSavingsMinor ?? incoming.savingsTotalMinor;
  const leftoverShape =
    leftoverIncomingShape(current) && leftoverIncomingShape(incoming);
  const sameLeftoverPool =
    current.livingPoolMinor > 0 &&
    incoming.livingPoolMinor === current.livingPoolMinor;
  const livingRegress = current.dayBudgetMinor < incoming.dayBudgetMinor;
  if (!livingRegress) return false;
  if (!leftoverShape && !sameLeftoverPool) {
    // Force-adopt already wrote 330,15 — still block vs post-write baseline.
    return (
      leftoverLivingBaseline != null &&
      incoming.livingPoolMinor === leftoverLivingBaseline.livingPoolMinor &&
      incoming.dayBudgetMinor > leftoverLivingBaseline.dayBudgetMinor &&
      incomingSave > 0 &&
      incomingSave <= leftoverLivingBaseline.saveMinor
    );
  }
  // Same-day restore 20k→15k leftover (275,12) must not jump to a 5-day
  // recompute (330,15) on Plan keep-shell sync — even if cycle spend rose.
  // Additive SEK warmup has planMonthSavingsMinor 0 and already returned.
  const cap = Math.max(currentSave, baselineSave);
  if (incomingSave > 0 && incomingSave <= cap) return true;
  if (incoming.cycleSpendingMinor > current.cycleSpendingMinor) return false;
  return incomingSave < currentSave;
}

export function rememberHomeSnapshot(
  snap: HomeSnapshot,
  opts?: { dirty?: boolean; force?: boolean; confirmSession?: boolean },
) {
  bindSessionOwner(snap.userId);
  const nextDirty = opts?.dirty ?? false;
  const confirmSession = opts?.confirmSession !== false;
  // Overlay before force: adoptMutationFinance({force:true}) is the live
  // write that published 330,15 after restore (server 5-day leftover).
  const incoming = applyLeftoverLivingBaseline(snap);
  if (
    home === incoming &&
    homeDirty === nextDirty &&
    (!confirmSession || homeSessionConfirmed)
  ) {
    gapFillAnalysFromKnown();
    gapFillMerFromHome();
    return;
  }
  if (
    !nextDirty &&
    !opts?.force &&
    home &&
    (!shouldAdoptFinanceSnapshot(home, incoming, homeDirty) ||
      isLeftoverSparLivingRevert(home, incoming))
  ) {
    gapFillAnalysFromKnown();
    gapFillMerFromHome();
    return;
  }
  home = nextDirty
    ? {
        ...incoming,
        verifiedAt: new Date().toISOString(),
        // Dirty only blocks a stale RSC echo. A successful local
        // calculation (optimistic SEK/THB spend) stays verified so Hem
        // does not flash "Vi kan inte räkna just nu." after a durable save.
        truthStatus:
          incoming.truthStatus === "unavailable"
            ? "unavailable"
            : incoming.truthStatus === "verified"
              ? "verified"
              : "stale",
      }
    : incoming;
  homeDirty = nextDirty;
  if (confirmSession) homeSessionConfirmed = true;
  maybeRememberLeftoverLivingBaseline(home);
  // Sync cookie write — do not wait on persist microtask. Warm hard-refresh
  // SSR needs numa.lastHome.v1 present after authenticated Hem has totals.
  writeLastHomeCookie(home);
  // Spec R / S2: write paint-able Analys last-known in this tick — before
  // subscribers or Spec S Konton adopt. Time-to-first-paint is last-known,
  // not fetch-done. Konton invalidate must not clear or delay this write.
  gapFillAnalysFromKnown();
  gapFillMerFromHome();
  emit(homeListeners);
  if (!nextDirty) {
    adoptAccountsLastKnown(null);
  }
}

export function lastHomeSnapshot(): HomeSnapshot | null {
  return home;
}

/** Live Hem paint only — hydrate/cookie alone must not flash as current money. */
export function lastSessionHomeSnapshot(): HomeSnapshot | null {
  return homeSessionConfirmed ? home : null;
}

export function applyOptimisticHomeSpend(amountMinor: number): HomeSnapshot | null {
  if (!home || amountMinor === 0) return home;
  const previous = home;
  const calculatedBalanceMinor =
    previous.calculatedBalanceMinor == null
      ? null
      : previous.calculatedBalanceMinor - amountMinor;
  const overMinor = cashOverMinor({
    saldoMinor: calculatedBalanceMinor,
    incomingMinor: previous.incomingMinor,
    unpaidMinor: previous.unpaidMinor,
    reservedSavingsMinor: previous.savingsTotalMinor,
  });
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
    return;
  }
  gapFillAnalysFromKnown();
}

/** Mutation result is the canonical revision — never lose it to a stale RSC echo. */
export function adoptMutationFinance(result: {
  home?: HomeSnapshot | null;
  plan?: PlanSnapshot | null;
  accounts?: AccountsSnapshot | null;
  movements?: MovementsSnapshot | null;
}) {
  if (result.home) rememberHomeSnapshot(result.home, { force: true });
  if (result.plan) rememberPlanSnapshot(result.plan, { force: true });
  if (result.accounts) rememberAccountsSnapshot(result.accounts);
  if (result.movements) rememberMovementsSnapshot(result.movements);
  confirmOptimisticFinance();
}

/** Drop Analys cache when money truth moves — next visit refetches shared revision. */
export function invalidateAnalysSnapshot() {
  analys = null;
}

/**
 * Plan ledger stays native for Rörelser edit. Spend windows must use the
 * same locked THB projection as assembleTodaySnapshot — otherwise SEK
 * rows are dropped by the THB currency filter and Hem-perioden lags.
 */
function canonicalSpendLedger(snapshot: PlanSnapshot) {
  const map = new Map<string, FxCheckpoint | null>();
  for (const row of snapshot.accounts?.accounts ?? []) {
    map.set(row.id, {
      accountId: row.id,
      balanceMinor: row.calculatedMinor ?? 0,
      thbMinor: row.thbMinor,
      fxRate: row.fxRate,
    });
  }
  for (const tx of snapshot.ledgerTransactions) {
    if (map.has(tx.accountId)) continue;
    if (tx.thbMinor == null && (tx.fxRate == null || tx.fxRate <= 0)) continue;
    map.set(tx.accountId, {
      accountId: tx.accountId,
      balanceMinor: 0,
      thbMinor: tx.thbMinor ?? null,
      fxRate: tx.fxRate ?? null,
    });
  }
  return projectLedgerToCanonicalThb(snapshot.ledgerTransactions, map);
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
  const spendLedger = canonicalSpendLedger(snapshot);
  const windows = computeClassifiedSpendingWindows({
    transactions: spendLedger,
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
  const savingsTotalMinor = coverage.reservedSavingsMinor;
  const nextSave = coverage.savingsThisMonthMinor ?? 0;
  const prevSave = home.planMonthSavingsMinor ?? 0;
  const sparDelta = nextSave - prevSave;
  const reserved =
    living.reservedUntilIncomeMinor > 0
      ? living.reservedUntilIncomeMinor
      : (home.reservedUntilIncomeMinor ?? 0) ||
        (home.reservedSavingsUntilIncomeMinor ?? 0) ||
        prevSave ||
        nextSave;
  const cashPool =
    (bankBalanceMinor ?? 0) - reserved + todaySpendingMinor;
  const homeLooksLeftover =
    home.remainingTodayMinor === home.dayBudgetMinor &&
    prevSave > 0 &&
    (home.calculatedBalanceMinor ?? 0) -
      (home.reservedSavingsUntilIncomeMinor ??
        home.planMonthSavingsMinor ??
        prevSave) +
      todaySpendingMinor <=
      0;
  const leftoverPath = cashPool <= 0 || homeLooksLeftover;
  const staleLowerSave = leftoverPath && nextSave < prevSave;
  // After setMonthSavings decrease, keep the adopted leftover living on
  // Hem↔Plan soft remount even if cashPool flipped (daysLeft 6→5 = 330,15).
  // Do not require remaining===dayBudget — today-spend leftover still keeps
  // post-write 275,12 vs a 5-day recompute.
  const restoreKeepAdopted =
    leftoverBaselineMatchesCivilDay(timeZone) &&
    prevSave > 0 &&
    nextSave > 0 &&
    nextSave <= prevSave &&
    home.dayBudgetMinor !== living.dayBudgetMinor;
  const keepAdoptedLiving =
    leftoverBaselineMatchesCivilDay(timeZone) &&
    (restoreKeepAdopted ||
      (leftoverPath &&
        home.dayBudgetMinor !== living.dayBudgetMinor &&
        (prevSave === nextSave || staleLowerSave)));
  const incrementBase = homeLooksLeftover
    ? {
        livingPoolMinor: home.livingPoolMinor,
        remainingFreeMinor: home.remainingFreeMinor,
        daysLeft: Math.max(1, home.spendDaysLeft || living.daysLeft),
        spentTodayMinor: todaySpendingMinor,
      }
    : {
        livingPoolMinor: living.livingPoolMinor,
        remainingFreeMinor: living.remainingFreeMinor,
        daysLeft: living.daysLeft,
        spentTodayMinor: todaySpendingMinor,
      };
  const adjusted =
    leftoverPath && sparDelta > 0 && prevSave > 0
      ? applyLeftoverSparDelta(incrementBase, sparDelta)
      : living;
  const livingPoolMinor = keepAdoptedLiving
    ? home.livingPoolMinor
    : adjusted.livingPoolMinor;
  const dayBudgetMinor = keepAdoptedLiving
    ? home.dayBudgetMinor
    : adjusted.dayBudgetMinor;
  const remainingTodayMinor = keepAdoptedLiving
    ? home.remainingTodayMinor
    : adjusted.remainingTodayMinor;
  const remainingFreeMinor = keepAdoptedLiving
    ? home.remainingFreeMinor
    : adjusted.remainingFreeMinor;
  const planMonthSavingsMinor = staleLowerSave
    ? (home.planMonthSavingsMinor ?? prevSave)
    : coverage.savingsThisMonthMinor;
  const reservedSavingsMinor = staleLowerSave
    ? home.savingsTotalMinor
    : savingsTotalMinor;
  const overMinor = staleLowerSave ? home.overMinor : coverage.overMinor;
  rememberHomeSnapshot(
    {
      ...home,
      calculatedBalanceMinor: bankBalanceMinor,
      todaySpendingMinor,
      todayPlannedPaidMinor,
      cycleSpendingMinor,
      safeToSpendTodayMinor: remainingTodayMinor,
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
      remainingFreeMinor,
      spendDaysLeft: living.daysUntilHorizon,
      dayBudgetMinor,
      remainingTodayMinor,
      livingPoolMinor,
      reservedUntilIncomeMinor: living.reservedUntilIncomeMinor,
      reservedSavingsUntilIncomeMinor: living.reservedSavingsMinor,
      reservedSavingsMonthKey: living.reservedSavingsMonthKey,
      daysUntilIncome: living.daysUntilHorizon,
      nextIncomeLabelSv: living.nextIncomeLabelSv,
      incomingMinor: coverage.incomingMinor,
      unpaidMinor: coverage.unpaidMinor,
      overMinor,
      savingsTotalMinor: reservedSavingsMinor,
      planMonthSavingsMinor,
      wealthTotalMinor: planWealthTotalMinor(overMinor, reservedSavingsMinor),
    },
    // Plan sync must not elevate hydrate → "live Hem" before home fetch.
    { dirty: homeDirty, confirmSession: false },
  );
}

/** @deprecated use syncHomeLivingFromPlan */
export function syncHomeCoverageFromPlan(snapshot: PlanSnapshot) {
  syncHomeLivingFromPlan(snapshot);
}

function analysLastKnownCanPaint(
  snap: AnalysSnapshot | null | undefined,
): boolean {
  return Boolean(snap?.month && snap.currentMonthKey);
}

function gapFillAnalysFromKnown() {
  if (analysLastKnownCanPaint(analys)) return;
  // Hem-thin only. Plan ledger FX + classified windows must not run on
  // Hem confirm, Plan remember, or Spec S Konton adopt — that was the
  // Qualityltf Analys tap stall when lastAnalys was empty.
  if (home) {
    const derived = analysSnapshotFromHome(home);
    if (analysLastKnownCanPaint(derived)) {
      rememberAnalysSnapshot(derived);
    }
  }
}

export function rememberAnalysSnapshot(snap: AnalysSnapshot) {
  if (analys === snap) return;
  // Unpaintable incumbents must not block Hem-thin via shouldAdopt
  // (gapFill early-return left heading+Perioden empty on Qualityltf).
  if (
    analysLastKnownCanPaint(analys) &&
    !shouldAdoptFinanceSnapshot(analys, snap, false)
  ) {
    return;
  }
  analys = snap;
  emit(analysListeners);
}

export function lastAnalysSnapshot(): AnalysSnapshot | null {
  return analys;
}

export function subscribeAnalysSnapshot(listener: () => void) {
  analysListeners.add(listener);
  return () => {
    analysListeners.delete(listener);
  };
}

function planStamp(snapshot: PlanSnapshot): string {
  return `${stampPlanItems(snapshot.items)}:${snapshot.bankBalanceMinor}:${snapshot.ledgerTransactions.length}:${snapshot.currency}:${snapshot.timeZone}`;
}

export function rememberPlanSnapshot(
  snapshot: PlanSnapshot,
  opts?: { force?: boolean },
) {
  if (plan === snapshot) return;
  if (!opts?.force && plan && !shouldAdoptFinanceSnapshot(plan, snapshot, false)) {
    return;
  }
  if (plan && planStamp(plan) === planStamp(snapshot)) {
    plan = snapshot;
    gapFillAnalysFromKnown();
    adoptAccountsLastKnown(snapshot.accounts ?? null);
    return;
  }
  const prevRev = plan?.financeRevision;
  plan = snapshot;
  // Drop a stale Analys revision, then Hem-thin gap-fill in this tick so
  // heading+Perioden never wait on Plan ledger FX or a Flight POST.
  if (
    analys &&
    snapshot.financeRevision &&
    analys.financeRevision !== snapshot.financeRevision
  ) {
    analys = null;
  } else if (prevRev && snapshot.financeRevision && prevRev !== snapshot.financeRevision) {
    analys = null;
  }
  gapFillAnalysFromKnown();
  emit(planListeners);
  adoptAccountsLastKnown(snapshot.accounts ?? null);
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
  schedulePersist();
}

export function lastAnalysScope(): "period" | "month" | null {
  return analysScope;
}

export function rememberGettingStarted(view: GettingStartedView | null) {
  if (gettingStarted === view) return;
  // A quieter warm must not rewind first-run progress (saldo just saved).
  if (
    view &&
    gettingStarted?.visible &&
    view.doneCount < gettingStarted.doneCount
  ) {
    return;
  }
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

function sameMovementsView(
  current: MovementsView | null,
  next: MovementsView,
): boolean {
  if (!current) return false;
  return (
    current.filter === next.filter &&
    current.period === next.period &&
    (current.category ?? null) === (next.category ?? null)
  );
}

/**
 * Rörelser filter chips, including the category chosen from Analys.
 *
 * Notifies subscribers so a screen that is already mounted follows along —
 * tabs stay mounted, so reading this only at mount time would leave Rörelser
 * on the previous chip after a category tap.
 */
export function rememberMovementsView(view: MovementsView) {
  if (sameMovementsView(movementsView, view)) return;
  movementsView = view;
  emit(movementsViewListeners);
}

export function subscribeMovementsView(listener: () => void) {
  movementsViewListeners.add(listener);
  return () => {
    movementsViewListeners.delete(listener);
  };
}

export function lastMovementsView(): MovementsView | null {
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
  if (
    accounts === snap &&
    accountsDirty === nextDirty &&
    accountsSessionConfirmed
  ) {
    return;
  }
  accounts = snap;
  accountsDirty = nextDirty;
  accountsSessionConfirmed = true;
  emit(accountsListeners);
}

export function lastAccountsSnapshot(): AccountsSnapshot | null {
  return accounts;
}

function accountsGuardRefs(): {
  hemBalanceMinor: number | null;
  fresherAccounts: AccountsSnapshot | null;
} {
  return {
    hemBalanceMinor:
      home?.calculatedBalanceMinor ?? plan?.bankBalanceMinor ?? null,
    fresherAccounts: plan?.accounts ?? null,
  };
}

/**
 * Last-known Konton may paint only when it agrees with Hem «På kontona»
 * and is not missing ids a fresher Plan/Hem source already has. A live
 * remember this session (fetch / mutation) always paints — Hem may lag.
 */
export function paintableAccountsSnapshot(): AccountsSnapshot | null {
  if (!accounts) return null;
  if (accountsDirty || accountsSessionConfirmed) return accounts;
  return accountsLastKnownCanPaint(accounts, accountsGuardRefs())
    ? accounts
    : null;
}

export function invalidateAccountsSnapshot() {
  if (accounts == null && !accountsSessionConfirmed) return;
  if (accountsDirty) return;
  accounts = null;
  accountsSessionConfirmed = false;
  emit(accountsListeners);
}

/**
 * Gap-fill or drop last-known Konton vs Hem/Plan. Never paints a poorer
 * Plan TodaySnapshot over a richer last-known (#138). Never keeps a stale
 * total or a strict subset of fresher ids (Spec S).
 */
/**
 * Last-known / quiet-warm / Hem-Plan adopt. Must not mark a live session
 * (that bypasses the Spec S paint guard) and must not touch Analys.
 */
function writeAccountsLastKnown(snap: AccountsSnapshot) {
  if (accounts === snap && !accountsDirty && !accountsSessionConfirmed) return;
  accounts = snap;
  accountsDirty = false;
  accountsSessionConfirmed = false;
  emit(accountsListeners);
}

export function adoptAccountsLastKnown(incoming: AccountsSnapshot | null) {
  if (accountsDirty) {
    gapFillAnalysFromKnown();
    return;
  }
  const decision = decideAccountsLastKnown(accounts, incoming, {
    hemBalanceMinor: accountsGuardRefs().hemBalanceMinor,
    fresherAccounts: incoming ?? accountsGuardRefs().fresherAccounts,
  });
  if (decision === "replace" && incoming) {
    writeAccountsLastKnown(incoming);
  } else if (decision === "invalidate") {
    invalidateAccountsSnapshot();
  }
  // Konton-only write. Restore Spec R Analys last-known if Plan revision-null
  // or persist quota left it empty — never delay heading+Perioden on adopt.
  gapFillAnalysFromKnown();
}

export function merSnapshotFromHome(snap: HomeSnapshot | null): MerSnapshot | null {
  if (!snap) return null;
  return {
    userId: snap.userId,
    displayName: chromeDisplayName(snap.displayName),
    isAdmin: false,
  };
}

function gapFillMerFromHome() {
  ensurePaintableMerSnapshot();
}

/** Paint-able Mer hub from last-known or Hem — same tick, no Flight. */
export function ensurePaintableMerSnapshot(): MerSnapshot | null {
  if (mer) return mer;
  const derived = merSnapshotFromHome(home);
  if (!derived) return null;
  rememberMerSnapshot(derived);
  return mer;
}

export function rememberMerSnapshot(snap: MerSnapshot) {
  bindSessionOwner(snap.userId);
  if (mer === snap) return;
  mer = snap;
  emit(merListeners);
}

export function lastMerSnapshot(): MerSnapshot | null {
  return mer;
}

export function subscribeMerSnapshot(listener: () => void) {
  merListeners.add(listener);
  return () => {
    merListeners.delete(listener);
  };
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
  schedulePersist();
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
    monthCategories: sortSpendDesc([...categoryMap.values()]),
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
  const overMinor = cashOverMinor({
    saldoMinor: calculatedBalanceMinor,
    incomingMinor,
    unpaidMinor,
    reservedSavingsMinor: previous.savingsTotalMinor,
  });
  const planSnap = lastPlanSnapshot();
  let remainingFreeMinor = previous.remainingFreeMinor;
  let freeToSpendMinor = previous.freeToSpendMinor;
  let planExpenseMinor = previous.planExpenseMinor;
  let dayBudgetMinor = previous.dayBudgetMinor;
  let remainingTodayMinor = previous.remainingTodayMinor;
  let livingPoolMinor = previous.livingPoolMinor;
  let reservedUntilIncomeMinor = previous.reservedUntilIncomeMinor;
  let reservedSavingsUntilIncomeMinor = previous.reservedSavingsUntilIncomeMinor;
  let reservedSavingsMonthKey = previous.reservedSavingsMonthKey;
  let usesBankBalance = previous.usesBankBalance;
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
      livingPoolMinor = living.livingPoolMinor;
      reservedUntilIncomeMinor = living.reservedUntilIncomeMinor;
      reservedSavingsUntilIncomeMinor = living.reservedSavingsMinor;
      reservedSavingsMonthKey = living.reservedSavingsMonthKey;
      usesBankBalance = living.usesBankBalance;
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
      livingPoolMinor,
      reservedUntilIncomeMinor,
      reservedSavingsUntilIncomeMinor,
      reservedSavingsMonthKey,
      usesBankBalance,
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
  const overMinor = cashOverMinor({
    saldoMinor: calculatedBalanceMinor,
    incomingMinor: previous.incomingMinor,
    unpaidMinor: previous.unpaidMinor,
    reservedSavingsMinor: previous.savingsTotalMinor,
  });
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
  const overMinor = cashOverMinor({
    saldoMinor: balanceMinor,
    incomingMinor: home.incomingMinor,
    unpaidMinor: home.unpaidMinor,
    reservedSavingsMinor: home.savingsTotalMinor,
  });
  const spentToday = Math.max(0, home.todaySpendingMinor);
  const reserved = Math.max(0, home.reservedUntilIncomeMinor ?? 0);
  const refreshDayEnvelope =
    home.needsAvailableInput ||
    home.livingMode === "bridge" ||
    home.usesBankBalance;
  const cashPool = balanceMinor + spentToday - reserved;
  const planPool = (home.remainingFreeMinor ?? 0) + spentToday;
  const livingPoolMinor = refreshDayEnvelope
    ? cashPool > 0
      ? cashPool
      : Math.max(0, planPool)
    : home.livingPoolMinor;
  const dayBudgetMinor = refreshDayEnvelope
    ? perDayBudgetMinor(livingPoolMinor, Math.max(1, home.spendDaysLeft))
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
            livingPoolMinor,
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

function thbTotal(rows: readonly AccountBalanceRow[]): number | null {
  let total: number | null = null;
  for (const row of rows) {
    const thb =
      row.thbMinor ?? (row.currency === "THB" ? row.calculatedMinor : null);
    if (thb == null) continue;
    total = (total ?? 0) + thb;
  }
  return total;
}

/**
 * Drop an account from the active Konton list. Archive keeps the row so
 * Rörelser can still name it. Hem «På kontona» uses the remaining total.
 */
export function applyAccountRemoval(
  accountId: string,
  mode: "delete" | "archive",
  fallbackRow?: AccountBalanceRow,
): AccountsSnapshot | null {
  if (!accounts) return accounts;
  const removed =
    accounts.accounts.find((row) => row.id === accountId) ?? fallbackRow;
  let nextActive = accounts.accounts.filter((row) => row.id !== accountId);
  if (
    removed?.isDefault &&
    nextActive.length > 0 &&
    !nextActive.some((row) => row.isDefault)
  ) {
    nextActive = nextActive.map((row, index) =>
      index === 0 ? { ...row, isDefault: true } : row,
    );
  }
  let archived = (accounts.archivedAccounts ?? []).filter(
    (row) => row.id !== accountId,
  );
  if (mode === "archive" && removed) {
    archived = [...archived, { ...removed, isActive: false, isDefault: false }];
  }
  const totalThbMinor = thbTotal(nextActive);
  rememberAccountsSnapshot(
    {
      accounts: nextActive,
      archivedAccounts: archived,
      totalThbMinor,
    },
    { dirty: true },
  );
  if (home) {
    if (totalThbMinor != null) {
      applyHomeBankBalance(totalThbMinor);
    } else if (nextActive.length === 0) {
      rememberHomeSnapshot(
        {
          ...home,
          calculatedBalanceMinor: null,
          hasBankTruth: false,
        },
        { dirty: true },
      );
    }
  }
  return accounts;
}

/** Server snapshots win for Hem. Archived rows stay visible under Konton. */
export function adoptRemovedAccount(
  result: {
    home?: HomeSnapshot | null;
    plan?: PlanSnapshot | null;
    accounts?: AccountsSnapshot | null;
    movements?: MovementsSnapshot | null;
    removedAccount?: { mode: "delete" | "archive" };
  },
  accountId: string,
  fallbackRow?: AccountBalanceRow,
): void {
  const mode = result.removedAccount?.mode ?? "archive";
  if (!result.accounts && !result.home && !result.movements && !result.plan) {
    applyAccountRemoval(accountId, mode, fallbackRow);
    return;
  }
  const previous = accounts;
  const incoming = result.accounts ?? null;
  const removed =
    previous?.accounts.find((row) => row.id === accountId) ?? fallbackRow;
  const nextActive = (incoming?.accounts ?? previous?.accounts ?? []).filter(
    (row) => row.id !== accountId,
  );
  const seen = new Set<string>();
  const nextArchived: AccountBalanceRow[] = [];
  for (const row of [
    ...(previous?.archivedAccounts ?? []),
    ...(incoming?.archivedAccounts ?? []),
  ]) {
    if (row.id === accountId || seen.has(row.id)) continue;
    seen.add(row.id);
    nextArchived.push(row);
  }
  if (mode === "archive" && removed) {
    nextArchived.push({ ...removed, isActive: false, isDefault: false });
  }
  const serverExcluded =
    incoming != null && !incoming.accounts.some((row) => row.id === accountId);
  adoptMutationFinance({
    home: result.home,
    plan: result.plan,
    movements: result.movements,
    accounts: {
      accounts: nextActive,
      archivedAccounts: nextArchived,
      totalThbMinor: serverExcluded ? incoming.totalThbMinor : thbTotal(nextActive),
    },
  });
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
    {
      accounts: nextAccounts,
      archivedAccounts: accounts.archivedAccounts ?? [],
      totalThbMinor,
    },
    { dirty: true },
  );
  return accounts;
}

export type OptimisticBalancePaint = {
  accounts: AccountsSnapshot | null;
  home: HomeSnapshot | null;
  movements: MovementsSnapshot | null;
  accountsDirty: boolean;
  homeDirty: boolean;
  movementsDirty: boolean;
};

/** Hem, Konton and Rörelser as they were before an optimistic saldo write. */
export function captureOptimisticBalance(): OptimisticBalancePaint {
  return {
    accounts,
    home,
    movements,
    accountsDirty,
    homeDirty,
    movementsDirty,
  };
}

/**
 * Put the three paints back after a rejected saldo.
 * applyAccountBalance cannot write a null balance, so a first saldo on an
 * empty account would otherwise stay on screen until reload.
 */
export function undoOptimisticBalance(paint: OptimisticBalancePaint): void {
  if (paint.home) {
    rememberHomeSnapshot(paint.home, {
      dirty: paint.homeDirty,
      force: true,
    });
  }
  if (paint.movements) {
    rememberMovementsSnapshot(paint.movements, {
      dirty: paint.movementsDirty,
    });
  }
  if (paint.accounts) {
    rememberAccountsSnapshot(paint.accounts, { dirty: paint.accountsDirty });
  }
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
        {
          accounts: nextAccounts,
          archivedAccounts: accounts.archivedAccounts ?? [],
          totalThbMinor,
        },
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
  const normalized: MovementRow = {
    ...row,
    nativeAmountMinor: row.nativeAmountMinor ?? row.amountMinor,
    nativeCurrency: row.nativeCurrency ?? row.currency,
  };
  rememberMovementsSnapshot(
    recomputeMovements(
      movements,
      sortNewestFirst([normalized, ...movements.items]),
      movementBalanceDelta(normalized),
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
  applyAccountDelta(
    -signedNativeDelta(item, item.nativeAmountMinor ?? item.amountMinor),
    item.accountId,
  );
  if (item.transactionType === "expense") {
    applyHomeForExpenseDelta(item, -item.amountMinor);
  } else if (item.transactionType === "income") {
    applyOptimisticHomeIncome(-item.amountMinor);
  }
  return movements;
}

function signedNativeDelta(tx: MovementRow, nativeMinor: number): number {
  if (tx.transactionType === "income" || tx.direction === "credit") {
    return nativeMinor;
  }
  if (tx.transactionType === "expense" || tx.direction === "debit") {
    return -nativeMinor;
  }
  return 0;
}

export function applyMovementsEdit(
  id: string,
  patch: {
    amountMinor: number;
    description: string;
    category?: string | null;
    nativeAmountMinor?: number;
    thbMinor?: number;
  },
): MovementsSnapshot | null {
  if (!movements) return null;
  const item = movements.items.find((tx) => tx.id === id);
  if (!item) return movements;
  const nextNative = patch.nativeAmountMinor ?? patch.amountMinor;
  const rate = item.fxRate ?? (item.nativeCurrency === "THB" ? 1 : null);
  const nextThb =
    patch.thbMinor ??
    (item.nativeCurrency === "THB" || rate == null
      ? nextNative
      : Math.round(nextNative * rate));
  const nextItem: MovementRow = {
    ...item,
    amountMinor: nextThb,
    nativeAmountMinor: nextNative,
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
  const nativeDelta =
    signedNativeDelta(nextItem, nextNative) -
    signedNativeDelta(item, item.nativeAmountMinor ?? item.amountMinor);
  applyAccountDelta(nativeDelta, item.accountId);
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
  thbAmountMinor?: number;
  nativeAmountMinor?: number;
  nativeCurrency?: CurrencyCode;
  fxRate?: number | null;
}) {
  const nativeMinor = input.nativeAmountMinor ?? input.amountMinor;
  const nativeCurrency = input.nativeCurrency ?? input.currency;
  const thbMinor =
    input.thbAmountMinor ??
    (nativeCurrency === "THB"
      ? nativeMinor
      : input.fxRate != null && input.fxRate > 0
        ? Math.round(nativeMinor * input.fxRate)
        : nativeMinor);
  applyOptimisticHomeSpend(thbMinor);
  applyAccountDelta(-nativeMinor, input.accountId);
  applyMovementsAdd({
    id: input.id ?? crypto.randomUUID(),
    description: input.description,
    category: input.category ?? null,
    transactionType: "expense",
    direction: "debit",
    amountMinor: thbMinor,
    currency: "THB",
    nativeAmountMinor: nativeMinor,
    nativeCurrency,
    accountId: input.accountId,
    fxRate: input.fxRate ?? (nativeCurrency === "THB" ? 1 : null),
    occurredAt: new Date().toISOString(),
    source: "manual",
  });
}

export function applyLocalIncome(input: {
  id?: string;
  amountMinor: number;
  description: string;
  currency: CurrencyCode;
  accountId?: string | null;
  thbAmountMinor?: number;
  nativeAmountMinor?: number;
  nativeCurrency?: CurrencyCode;
  fxRate?: number | null;
}) {
  const nativeMinor = input.nativeAmountMinor ?? input.amountMinor;
  const nativeCurrency = input.nativeCurrency ?? input.currency;
  const thbMinor =
    input.thbAmountMinor ??
    (nativeCurrency === "THB"
      ? nativeMinor
      : input.fxRate != null && input.fxRate > 0
        ? Math.round(nativeMinor * input.fxRate)
        : nativeMinor);
  applyOptimisticHomeIncome(thbMinor);
  applyAccountDelta(nativeMinor, input.accountId);
  applyMovementsAdd({
    id: input.id ?? crypto.randomUUID(),
    description: input.description,
    category: null,
    transactionType: "income",
    direction: "credit",
    amountMinor: thbMinor,
    currency: "THB",
    nativeAmountMinor: nativeMinor,
    nativeCurrency,
    accountId: input.accountId,
    fxRate: input.fxRate ?? (nativeCurrency === "THB" ? 1 : null),
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
