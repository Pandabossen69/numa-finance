import {
  balanceToThbMinor,
  calculateAccountBalance,
  calculatePlanTotals,
  calculateSafeToSpend,
  checkpointMapForAccounts,
  computeClassifiedSpendingWindows,
  computeFinanceRevision,
  filterTransactionsAfterCheckpoint,
  formatRelativeVerificationSv,
  hasCycleFundingEvidence,
  monthKeyFromDate,
  projectLedgerToCanonicalThb,
  projectPayCycle,
  projectPlanForMonth,
  spendingByMonthKey,
  totalSaldoThbMinor,
  type Account,
  type BalanceCheckpoint,
  type CanonicalTransaction,
  type PlanItem,
  type Profile,
} from "@/domain/finance";
import { money, type CurrencyCode } from "@/domain/money";
import { emptyTodaySnapshot } from "./empty-snapshot";
import type { SnapshotAccountBalance, TodaySnapshot } from "./types-snapshot";

export function assembleTodaySnapshot(input: {
  profile: Profile;
  accounts: Account[];
  planItems: PlanItem[];
  primary: Account | null;
  checkpoint: BalanceCheckpoint | null;
  checkpoints: Array<BalanceCheckpoint | null>;
  transactions: CanonicalTransaction[];
  now?: Date;
}): TodaySnapshot {
  const {
    profile,
    accounts,
    planItems,
    primary,
    checkpoint,
    checkpoints,
    transactions,
  } = input;
  const now = input.now ?? new Date();

  if (!primary) {
    return emptyTodaySnapshot(profile, accounts, null, planItems);
  }

  const timezone = profile.timezone || "Asia/Bangkok";
  const checkpointByAccountId = checkpointMapForAccounts(accounts, checkpoints);
  const fullCheckpointByAccountId = new Map(
    accounts.map((account, index) => [account.id, checkpoints[index] ?? null]),
  );
  const canonicalTx = projectLedgerToCanonicalThb(
    transactions,
    checkpointByAccountId,
  );

  const after = filterTransactionsAfterCheckpoint(
    transactions.filter((tx) => tx.accountId === primary.id),
    checkpoint,
  );
  let calculated = null;
  if (checkpoint) {
    try {
      calculated = calculateAccountBalance({
        checkpoint,
        transactionsAfterCheckpoint: after,
      });
    } catch (error) {
      console.error("[numa] balance calc failed", error);
    }
  }

  const perAccount = accounts.map((account) => {
    const cp = fullCheckpointByAccountId.get(account.id) ?? null;
    let nativeMinor: number | null = null;
    if (account.id === primary.id) {
      nativeMinor = calculated?.amountMinor ?? null;
    } else if (cp) {
      const afterOther = filterTransactionsAfterCheckpoint(
        transactions.filter((tx) => tx.accountId === account.id),
        cp,
      );
      try {
        nativeMinor =
          calculateAccountBalance({
            checkpoint: cp,
            transactionsAfterCheckpoint: afterOther,
          })?.amountMinor ?? null;
      } catch (error) {
        console.error("[numa] secondary balance calc failed", error);
        nativeMinor = cp.balanceMinor;
      }
    }
    return { account, nativeMinor, checkpoint: cp };
  });
  const accountBalances: SnapshotAccountBalance[] = perAccount.map((row) => ({
    accountId: row.account.id,
    nativeMinor: row.nativeMinor,
    thbMinor:
      row.nativeMinor != null && row.checkpoint
        ? balanceToThbMinor(
            row.nativeMinor,
            row.account.currency,
            row.checkpoint,
          )
        : row.nativeMinor != null && row.account.currency === "THB"
          ? row.nativeMinor
          : null,
    fxRate: row.checkpoint?.fxRate ?? null,
    fxSource: row.checkpoint?.fxSource ?? null,
  }));
  const calculatedBalanceMinor = totalSaldoThbMinor(perAccount);

  const currency = "THB" as CurrencyCode;
  const monthKey = monthKeyFromDate(now, timezone);
  const projection = projectPlanForMonth(planItems, monthKey, timezone);
  const cycle = projectPayCycle(planItems, now, timezone);
  const totals = calculatePlanTotals(planItems, currency, now, 0, timezone);
  const reservedMinor = cycle.reservedMinor + cycle.savingsMinor;
  const bufferMinor = cycle.bufferMinor;
  const daysUntilNextIncome = Math.max(
    1,
    cycle.startAt ? cycle.daysLeft : totals.daysUntilNextIncome || 1,
  );
  const windows = computeClassifiedSpendingWindows({
    transactions: canonicalTx,
    currency,
    now,
    timeZone: timezone,
    cycleStartAt: cycle.startAt,
    cycleEndAt: cycle.endAt,
  });
  const fundingConfirmed = hasCycleFundingEvidence({
    cycleStartAt: cycle.startAt,
    cycleEndAt: cycle.endAt,
    transactions: canonicalTx,
  });
  const safe =
    calculatedBalanceMinor != null
      ? calculateSafeToSpend({
          available: money(calculatedBalanceMinor, currency),
          reserved: money(reservedMinor, currency),
          safetyBuffer: money(bufferMinor, currency),
          daysUntilNextIncome,
          flexiblePlanRemaining:
            cycle.flexibleMinor > 0 ? money(cycle.flexibleMinor, currency) : undefined,
        })
      : null;

  let balanceKind: TodaySnapshot["balanceKind"] = "unknown";
  if (checkpoint && after.length === 0) balanceKind = "verified_checkpoint_only";
  else if (checkpoint && calculated) balanceKind = "calculated";
  else if (checkpoint) balanceKind = "verified_checkpoint_only";
  else if (calculatedBalanceMinor != null) balanceKind = "calculated";

  const todaySpendingMinor = windows.today.discretionary.amountMinor;
  const todayPlannedPaidMinor = windows.today.plannedPaid.amountMinor;
  const monthSpendingMinor = windows.month.total.amountMinor;
  const cycleSpendingMinor = windows.cycle.total.amountMinor;
  const recentTransactions = [...transactions]
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, 8);

  return {
    profile,
    accounts,
    primaryAccount: primary,
    checkpoint,
    accountBalances,
    calculatedBalanceMinor,
    balanceKind,
    verificationLabel: checkpoint
      ? formatRelativeVerificationSv(checkpoint.verifiedAt, now)
      : null,
    todaySpendingMinor,
    todayPlannedPaidMinor,
    monthSpendingMinor,
    cycleSpendingMinor,
    monthSpendingByKey: spendingByMonthKey({
      transactions: canonicalTx,
      currency,
      timeZone: timezone,
    }),
    fundingConfirmed,
    safeToSpendTodayMinor: safe?.today.amountMinor ?? 0,
    safeToSpendWeekMinor: safe?.week.amountMinor ?? 0,
    freeMinor: safe?.free.amountMinor ?? 0,
    reservedMinor: cycle.expenseMinor || projection.totalPlannedMinor,
    bufferMinor,
    flexibleMinor: cycle.flexibleMinor || projection.flexibleMinor,
    daysUntilIncome: daysUntilNextIncome,
    recentTransactions,
    ledgerTransactions: canonicalTx,
    planItems,
    currency,
    progress: null,
    financeRevision: computeFinanceRevision({
      planItems,
      ledgerTransactions: canonicalTx,
      calculatedBalanceMinor,
      cycleSpendingMinor,
      todaySpendingMinor,
    }),
    verifiedAt: now.toISOString(),
  };
}
