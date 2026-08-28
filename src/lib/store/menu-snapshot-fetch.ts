import {
  APP_PLAN_START_MONTH,
  projectPayCycle,
  snapshotLedgerWindow,
  startOfZonedMonth,
  type Account,
  type BalanceCheckpoint,
  type CanonicalTransaction,
  type PlanItem,
  type Profile,
} from "@/domain/finance";

/** Tables Hem / Plan / Analys always read — started in one parallel wave. */
export const MENU_SNAPSHOT_CORE_TABLES = [
  "profiles",
  "accounts",
  "plan_items",
] as const;

/** Extra reads only when the user already has a primary account. */
export const MENU_SNAPSHOT_ACCOUNT_TABLES = [
  "balance_checkpoints",
  "transactions",
] as const;

/** Gamification — unused by Hem / Plan / Analys loaders. */
export const MENU_SNAPSHOT_UNUSED_TABLES = [
  "user_progress",
  "progress_events",
] as const;

export type MenuSnapshotSources = {
  loadProfile: () => Promise<Profile>;
  loadAccounts: () => Promise<Account[]>;
  loadPlanItems: () => Promise<PlanItem[]>;
  loadCheckpoint: (accountId: string) => Promise<BalanceCheckpoint | null>;
  loadTransactions: (
    accountId: string,
    options: { sinceIso: string },
  ) => Promise<CanonicalTransaction[]>;
};

export type MenuSnapshotBundle = {
  profile: Profile;
  accounts: Account[];
  planItems: PlanItem[];
  primary: Account | null;
  checkpoint: BalanceCheckpoint | null;
  transactions: CanonicalTransaction[];
};

function historySince(timeZone: string): Date {
  return startOfZonedMonth(
    new Date(`${APP_PLAN_START_MONTH}-15T12:00:00.000Z`),
    timeZone,
  );
}

/**
 * Menu snapshot IO for a (possibly empty) invited account.
 *
 * Wave 1 (always, parallel): profile, accounts, plan items.
 * Checkpoint starts as soon as accounts resolve — it does not wait for plan items.
 * Wave 2 (account only, parallel): checkpoint + ledger in the spend window.
 * Never touches user_progress / progress_events.
 */
export async function fetchMenuSnapshotBundle(
  sources: MenuSnapshotSources,
  now: Date = new Date(),
): Promise<MenuSnapshotBundle> {
  const profileP = sources.loadProfile();
  const accountsP = sources.loadAccounts();
  const planItemsP = sources.loadPlanItems();

  const accounts = await accountsP;
  const primary = accounts.find((a) => a.isDefault) ?? accounts[0] ?? null;
  const checkpointP = primary
    ? sources.loadCheckpoint(primary.id)
    : Promise.resolve(null);

  const [profile, planItems] = await Promise.all([profileP, planItemsP]);

  if (!primary) {
    return {
      profile,
      accounts,
      planItems,
      primary: null,
      checkpoint: null,
      transactions: [],
    };
  }

  const timeZone = profile.timezone || "Asia/Bangkok";
  const monthStart = startOfZonedMonth(now, timeZone);
  const cycle = projectPayCycle(planItems, now, timeZone);
  const since = historySince(timeZone);
  const spendWindow = snapshotLedgerWindow({
    monthStart,
    cycleStartAt: cycle.startAt,
    historySince: since,
  });

  const [checkpoint, spendTx] = await Promise.all([
    checkpointP,
    sources.loadTransactions(primary.id, {
      sinceIso: spendWindow.spendSinceIso,
    }),
  ]);

  const ledger = snapshotLedgerWindow({
    monthStart,
    cycleStartAt: cycle.startAt,
    checkpointVerifiedAt: checkpoint?.verifiedAt,
    historySince: since,
  });

  const transactions =
    ledger.refetchFromCheckpoint &&
    ledger.saldoSinceIso !== spendWindow.spendSinceIso
      ? await sources.loadTransactions(primary.id, {
          sinceIso: ledger.saldoSinceIso,
        })
      : spendTx;

  return {
    profile,
    accounts,
    planItems,
    primary,
    checkpoint,
    transactions,
  };
}
