import {
  ACCOUNT_KIND_LABEL_SV,
  applyLeftoverSparDelta,
  extraSaldoHintSv,
  labelMonthSv,
  monthKeyFromDate,
  planWealthTotalMinor,
  projectCashCoverage,
  projectExtraSaldo,
  projectLivingBudget,
  projectPayCycle,
} from "@/domain/finance";
import type { BalanceCheckpoint } from "@/domain/finance";
import type { AccountsSnapshot } from "@/features/finance/load-accounts";
import type { HomeSnapshot } from "@/features/finance/load-home";
import {
  buildMovementsSnapshot,
  type MovementsSnapshot,
} from "@/features/finance/load-movements";
import type { PlanSnapshot } from "@/features/finance/load-plan";
import type { TodaySnapshot } from "@/lib/store/types-snapshot";

/** Map one server snapshot into the Hem view — no second read. */
export function homeSnapshotFromToday(
  snap: TodaySnapshot,
  now = new Date(),
): HomeSnapshot {
  const timeZone = snap.profile.timezone || "Asia/Bangkok";
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

  const extra = projectExtraSaldo({
    planItems: snap.planItems ?? [],
    spendingByMonthKey: snap.monthSpendingByKey ?? {},
    monthKey,
    currentMonthKey: monthKey,
    timeZone,
  });
  const coverage = projectCashCoverage({
    planItems: snap.planItems ?? [],
    transactions: snap.ledgerTransactions ?? [],
    monthKey,
    timeZone,
    saldoMinor: snap.calculatedBalanceMinor,
  });
  const savingsTotalMinor = coverage.reservedSavingsMinor;

  return {
    userId: snap.profile.id,
    displayName: snap.profile.displayName,
    timeZone,
    primaryAccountId: snap.primaryAccount?.id ?? null,
    currency: snap.currency,
    monthKey,
    monthLabelSv: labelMonthSv(monthKey),
    hasBankTruth: snap.calculatedBalanceMinor != null,
    calculatedBalanceMinor: snap.calculatedBalanceMinor,
    verificationLabel: snap.verificationLabel,
    todaySpendingMinor: snap.todaySpendingMinor,
    todayPlannedPaidMinor: snap.todayPlannedPaidMinor,
    monthSpendingMinor: snap.monthSpendingMinor,
    cycleSpendingMinor,
    safeToSpendTodayMinor: living.remainingTodayMinor,
    cycleStartLabelSv: cycle.startLabelSv,
    cycleEndLabelSv: living.cycleEndLabelSv,
    cycleEndInferred: living.cycleEndInferred,
    cycleIsActive: cycle.isActive && snap.fundingConfirmed,
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
    livingPoolMinor: living.livingPoolMinor,
    reservedUntilIncomeMinor: living.reservedUntilIncomeMinor,
    reservedSavingsUntilIncomeMinor: living.reservedSavingsMinor,
    reservedSavingsMonthKey: living.reservedSavingsMonthKey,
    daysUntilIncome: living.daysUntilHorizon,
    nextIncomeLabelSv: living.nextIncomeLabelSv,
    extraSaldoMinor: extra.extraSaldoMinor,
    extraSaldoDrawnMinor: extra.drawnMinor,
    extraSaldoHint: extraSaldoHintSv(extra, monthKey) ?? null,
    extraCarriedInMinor: extra.carriedInMinor,
    savingsTotalMinor,
    planMonthSavingsMinor: coverage.savingsThisMonthMinor,
    wealthTotalMinor: planWealthTotalMinor(coverage.overMinor, savingsTotalMinor),
    monthResultMinor: extra.monthResultMinor,
    incomingMinor: coverage.incomingMinor,
    unpaidMinor: coverage.unpaidMinor,
    overMinor: coverage.overMinor,
    financeRevision: snap.financeRevision,
    verifiedAt: snap.verifiedAt,
    truthStatus: "verified",
  };
}

/**
 * After a month-avsätt save on the leftover path, apply only the spar
 * increment so Hem matches Plan preview. Skip 0→N (keeps Spec L 275,12).
 * Skip decrease / nollställ: the post-write snapshot is already leftover
 * at the new amount (20→15 = 275,12). Re-applying −5k turns that into
 * 1 108,45 and soft-nav Hem stays stale until hard reload.
 */
export function applyHomeLeftoverSparDelta(
  home: HomeSnapshot,
  sparDeltaMinor: number,
  previousSaveMinor: number,
): HomeSnapshot {
  if (sparDeltaMinor <= 0 || previousSaveMinor <= 0) return home;
  const spentToday = Math.max(0, home.todaySpendingMinor ?? 0);
  const reserved =
    home.reservedUntilIncomeMinor && home.reservedUntilIncomeMinor > 0
      ? home.reservedUntilIncomeMinor
      : (home.reservedSavingsUntilIncomeMinor ?? 0) ||
        (home.planMonthSavingsMinor ?? previousSaveMinor);
  const cashPool =
    (home.calculatedBalanceMinor ?? 0) - reserved + spentToday;
  if (cashPool > 0) return home;
  const next = applyLeftoverSparDelta(
    {
      livingPoolMinor: home.livingPoolMinor,
      remainingFreeMinor: home.remainingFreeMinor,
      daysLeft: Math.max(1, home.spendDaysLeft),
      spentTodayMinor: spentToday,
    },
    sparDeltaMinor,
  );
  return {
    ...home,
    livingPoolMinor: next.livingPoolMinor,
    remainingFreeMinor: next.remainingFreeMinor,
    dayBudgetMinor: next.dayBudgetMinor,
    remainingTodayMinor: next.remainingTodayMinor,
    safeToSpendTodayMinor: next.remainingTodayMinor,
    planMonthSavingsMinor: previousSaveMinor + sparDeltaMinor,
  };
}

export function planSnapshotFromToday(snap: TodaySnapshot): PlanSnapshot {
  return {
    items: snap.planItems ?? [],
    currency: snap.currency,
    timeZone: snap.profile.timezone || "Asia/Bangkok",
    bankBalanceMinor: snap.calculatedBalanceMinor,
    spendingByMonthKey: snap.monthSpendingByKey ?? {},
    ledgerTransactions: snap.ledgerTransactions ?? [],
    accounts: accountsSnapshotFromToday(snap),
    financeRevision: snap.financeRevision,
    verifiedAt: snap.verifiedAt,
    truthStatus: "verified",
  };
}

export function accountsSnapshotFromToday(snap: TodaySnapshot): AccountsSnapshot {
  const byId = new Map(
    (snap.accountBalances ?? []).map((row) => [row.accountId, row]),
  );
  const accounts = snap.accounts.map((account) => {
    const bal = byId.get(account.id);
    return {
      id: account.id,
      name: account.name,
      institution: account.institution,
      maskedIdentifier: account.maskedIdentifier,
      kind: account.kind,
      kindLabelSv: ACCOUNT_KIND_LABEL_SV[account.kind],
      currency: account.currency,
      isDefault: account.isDefault,
      isActive: account.isActive,
      calculatedMinor: bal?.nativeMinor ?? null,
      thbMinor: bal?.thbMinor ?? null,
      fxRate: bal?.fxRate ?? null,
      fxSource: bal?.fxSource ?? null,
    };
  });
  let totalThbMinor: number | null = null;
  for (const row of accounts) {
    if (row.thbMinor == null) continue;
    totalThbMinor = (totalThbMinor ?? 0) + row.thbMinor;
  }
  return { accounts, archivedAccounts: [], totalThbMinor };
}

export function movementsSnapshotFromToday(
  snap: TodaySnapshot,
  now = new Date(),
): MovementsSnapshot {
  const byId = new Map(
    (snap.accountBalances ?? []).map((row) => [row.accountId, row]),
  );
  const checkpoints: Array<BalanceCheckpoint | null> = snap.accounts.map(
    (account) => {
      const bal = byId.get(account.id);
      if (!bal) return null;
      return {
        id: `snap-${account.id}`,
        userId: snap.profile.id,
        accountId: account.id,
        balanceMinor: bal.nativeMinor ?? 0,
        currency: account.currency,
        thbMinor: bal.thbMinor,
        fxRate: bal.fxRate,
        fxAsOf: snap.verifiedAt,
        fxSource: bal.fxSource,
        verifiedAt: snap.verifiedAt,
        source: "snapshot",
        sourceObservationId: null,
        note: null,
        createdAt: snap.verifiedAt,
      };
    },
  );
  return buildMovementsSnapshot({
    accounts: snap.accounts,
    transactions: snap.ledgerTransactions ?? [],
    checkpoints,
    timeZone: snap.profile.timezone || "Asia/Bangkok",
    now,
  });
}
