import { beforeEach, describe, expect, it } from "vitest";
import {
  applyMovementsEdit,
  clearClientSessionCaches,
  lastHomeSnapshot,
  rememberHomeSnapshot,
  syncHomeLivingFromPlan,
} from "@/features/home/last-snapshot";
import { assembleTodaySnapshot } from "@/lib/store/assemble-today-snapshot";
import type {
  Account,
  BalanceCheckpoint,
  CanonicalTransaction,
  PlanItem,
  Profile,
} from "@/domain/finance";
import { homeSnapshotFromToday, movementsSnapshotFromToday } from "./snapshot-from-today";
import type { HomeSnapshot } from "./load-home";
import type { PlanSnapshot } from "./load-plan";

const tz = "Asia/Bangkok";
const now = new Date("2026-09-05T08:00:00.000Z");

function profile(): Profile {
  return {
    id: "u1",
    displayName: "Hugo",
    timezone: tz,
    primaryCurrency: "THB",
    referenceCurrency: "THB",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    onboardingSaldoAt: "2026-08-01T00:00:00.000Z",
    onboardingCompletedAt: "2026-08-01T00:00:00.000Z",
    gettingStartedCompletedAt: null,
    gettingStartedCollapsed: false,
  };
}

function account(
  partial: Pick<Account, "id" | "name" | "kind" | "currency"> & Partial<Account>,
): Account {
  return {
    userId: "u1",
    institution: null,
    accountType: partial.kind === "cash" ? "cash" : "checking",
    maskedIdentifier: null,
    isActive: true,
    isDefault: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...partial,
  };
}

function checkpoint(
  accountId: string,
  balanceMinor: number,
  extra: Partial<BalanceCheckpoint> = {},
): BalanceCheckpoint {
  const currency = extra.currency ?? "THB";
  return {
    id: `cp-${accountId}`,
    userId: "u1",
    accountId,
    balanceMinor,
    currency,
    thbMinor:
      extra.thbMinor ??
      (currency === "THB"
        ? balanceMinor
        : extra.fxRate
          ? Math.round(balanceMinor * extra.fxRate)
          : null),
    fxRate: extra.fxRate ?? (currency === "THB" ? 1 : null),
    fxAsOf: extra.fxAsOf ?? "2026-09-01T00:00:00.000Z",
    fxSource: extra.fxSource ?? (currency === "THB" ? "identity" : "manual"),
    verifiedAt: "2026-09-01T00:00:00.000Z",
    source: "manual",
    sourceObservationId: null,
    note: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...extra,
  };
}

function tx(
  partial: Partial<CanonicalTransaction> &
    Pick<CanonicalTransaction, "id" | "accountId" | "amountMinor" | "occurredAt">,
): CanonicalTransaction {
  return {
    userId: "u1",
    counterAccountId: null,
    direction: "debit",
    transactionType: "expense",
    currency: "THB",
    description: partial.description ?? "köp",
    merchant: null,
    category: null,
    source: "manual",
    status: "confirmed",
    balanceAfterMinor: null,
    fingerprint: null,
    sourceObservationId: null,
    transferGroupId: null,
    planItemId: null,
    ledgerOrigin: "external",
    linkedPlanItemId: null,
    syncStatus: "saved",
    createdAt: partial.occurredAt,
    updatedAt: partial.occurredAt,
    ...partial,
  };
}

function planItem(
  partial: Partial<PlanItem> & Pick<PlanItem, "name" | "kind" | "amountMinor">,
): PlanItem {
  return {
    id: partial.id ?? "plan-1",
    userId: "u1",
    name: partial.name,
    kind: partial.kind,
    amountMinor: partial.amountMinor,
    currency: "THB",
    cadence: partial.cadence ?? "monthly",
    nextDueAt: partial.nextDueAt ?? "2026-09-25T12:00:00.000Z",
    isActive: true,
    settledAt: partial.settledAt ?? null,
    settledMinor: partial.settledMinor ?? null,
    remainingDueAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

const thbAccount = account({
  id: "bank",
  name: "Bangkok Bank",
  kind: "thai_bank",
  currency: "THB",
  isDefault: true,
});
const sekAccount = account({
  id: "test-sek",
  name: "Test-SEK",
  kind: "swedish_bank",
  currency: "SEK",
});

const cycleItems = [
  planItem({
    id: "lon",
    name: "Lön",
    kind: "expected",
    amountMinor: 60_000_00,
    cadence: "income",
    nextDueAt: "2026-09-25T12:00:00.000Z",
    settledAt: "2026-08-25T12:00:00.000Z",
    settledMinor: 60_000_00,
  }),
  planItem({
    id: "lon-prev",
    name: "Lön aug",
    kind: "expected",
    amountMinor: 60_000_00,
    cadence: "income",
    nextDueAt: "2026-08-25T12:00:00.000Z",
    settledAt: "2026-08-25T12:00:00.000Z",
    settledMinor: 60_000_00,
  }),
];

const thbCp = checkpoint("bank", 80_000_00);
const sekCp = checkpoint("test-sek", 1_000_00, {
  currency: "SEK",
  fxRate: 3.5,
  thbMinor: 3_500_00,
});

const thbSpend = tx({
  id: "thb-period",
  accountId: "bank",
  amountMinor: 38_712_00,
  thbMinor: 38_712_00,
  fxRate: 1,
  occurredAt: "2026-09-02T04:00:00.000Z",
  description: "THB period",
});
const oldSek = tx({
  id: "audit-sek-10",
  accountId: "test-sek",
  amountMinor: 10_00,
  currency: "SEK",
  thbMinor: 35_00,
  fxRate: 3.5,
  occurredAt: "2026-09-03T05:00:00.000Z",
  description: "Audit SEK 10",
});
const newSek = tx({
  id: "qa79-sek",
  accountId: "test-sek",
  amountMinor: 10_00,
  currency: "SEK",
  thbMinor: 35_00,
  fxRate: 3.5,
  occurredAt: "2026-09-05T07:00:00.000Z",
  description: "QA79 SEK pilot",
});

function assemble(transactions: CanonicalTransaction[]) {
  return assembleTodaySnapshot({
    profile: profile(),
    accounts: [thbAccount, sekAccount],
    planItems: cycleItems,
    primary: thbAccount,
    checkpoint: thbCp,
    checkpoints: [thbCp, sekCp],
    transactions,
    now,
  });
}

function planFromToday(snap: ReturnType<typeof assemble>): PlanSnapshot {
  return {
    items: cycleItems,
    currency: "THB",
    timeZone: tz,
    bankBalanceMinor: snap.calculatedBalanceMinor,
    spendingByMonthKey: snap.monthSpendingByKey,
    ledgerTransactions: snap.ledgerTransactions,
    accounts: {
      accounts: [
        {
          id: "bank",
          name: "Bangkok Bank",
          institution: null,
          maskedIdentifier: null,
          kind: "thai_bank",
          kindLabelSv: "Thai-bank",
          currency: "THB",
          isDefault: true,
          calculatedMinor: 80_000_00,
          thbMinor: 80_000_00,
          fxRate: 1,
          fxSource: "identity",
        },
        {
          id: "test-sek",
          name: "Test-SEK",
          institution: null,
          maskedIdentifier: null,
          kind: "swedish_bank",
          kindLabelSv: "Svensk bank",
          currency: "SEK",
          isDefault: false,
          calculatedMinor: 1_000_00,
          thbMinor: 3_500_00,
          fxRate: 3.5,
          fxSource: "manual",
        },
      ],
      totalThbMinor: 83_500_00,
    },
    financeRevision: snap.financeRevision,
    verifiedAt: snap.verifiedAt,
    truthStatus: "verified",
  };
}

describe("Hem period total vs Rörelser for native SEK expenses", () => {
  beforeEach(() => {
    clearClientSessionCaches();
  });

  it("keeps Hem-perioden aligned with Rörelser before edit, after edit, and after reload", () => {
    const firstSnap = assemble([thbSpend, oldSek, newSek]);
    const firstHome = homeSnapshotFromToday(firstSnap, now);
    const firstMovements = movementsSnapshotFromToday(firstSnap, now);

    expect(firstMovements.items.find((row) => row.id === "audit-sek-10")?.amountMinor).toBe(35_00);
    expect(firstMovements.items.find((row) => row.id === "qa79-sek")?.nativeAmountMinor).toBe(10_00);
    expect(firstMovements.monthExpenseMinor).toBe(38_712_00 + 35_00 + 35_00);
    expect(firstHome.cycleSpendingMinor).toBe(firstMovements.monthExpenseMinor);
    expect(firstHome.todaySpendingMinor).toBe(35_00);

    rememberHomeSnapshot(firstHome);
    applyMovementsEdit("qa79-sek", {
      amountMinor: 20_00,
      nativeAmountMinor: 20_00,
      description: "QA79 SEK pilot",
    });

    const editedSek = {
      ...newSek,
      amountMinor: 20_00,
      thbMinor: 70_00,
    };
    const reloadedSnap = assemble([thbSpend, oldSek, editedSek]);
    const reloadedHome = homeSnapshotFromToday(reloadedSnap, now);
    const reloadedMovements = movementsSnapshotFromToday(reloadedSnap, now);

    expect(reloadedMovements.items.find((row) => row.id === "qa79-sek")?.nativeAmountMinor).toBe(20_00);
    expect(reloadedMovements.items.find((row) => row.id === "qa79-sek")?.amountMinor).toBe(70_00);
    expect(reloadedMovements.monthExpenseMinor).toBe(38_712_00 + 35_00 + 70_00);
    expect(reloadedHome.cycleSpendingMinor).toBe(reloadedMovements.monthExpenseMinor);
    expect(reloadedHome.todaySpendingMinor).toBe(70_00);

    // Plan warmup used to recompute Hem-perioden from native SEK rows and
    // drop them. After reload the client must keep the Rörelser total.
    rememberHomeSnapshot(reloadedHome);
    syncHomeLivingFromPlan(planFromToday(reloadedSnap));
    const afterWarmup = lastHomeSnapshot() as HomeSnapshot;
    expect(afterWarmup.cycleSpendingMinor).toBe(reloadedMovements.monthExpenseMinor);
    expect(afterWarmup.todaySpendingMinor).toBe(70_00);
    expect(afterWarmup.truthStatus).toBe("verified");
  });

  it("Plan warmup cannot drop locked SEK spend from an already-correct Hem period", () => {
    const thbOnly = homeSnapshotFromToday(assemble([thbSpend]), now);
    expect(thbOnly.cycleSpendingMinor).toBe(38_712_00);
    rememberHomeSnapshot(thbOnly);

    const withSek = assemble([thbSpend, oldSek, { ...newSek, amountMinor: 20_00, thbMinor: 70_00 }]);
    syncHomeLivingFromPlan(planFromToday(withSek));

    expect(lastHomeSnapshot()?.cycleSpendingMinor).toBe(38_712_00 + 35_00 + 70_00);
    expect(lastHomeSnapshot()?.truthStatus).toBe("verified");
  });
});
