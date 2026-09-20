import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { analysViewCanPaint } from "@/features/finance/analys-client-fetch";
import { ensurePaintableAnalysSnapshot } from "@/features/finance/ensure-analys-last-known";
import type { AccountsSnapshot } from "@/features/finance/load-accounts";
import type { HomeSnapshot } from "@/features/finance/load-home";
import type { PlanSnapshot } from "@/features/finance/load-plan";
import { writePersistedLastKnown } from "@/features/home/last-snapshot-persist";
import {
  adoptAccountsLastKnown,
  clearClientSessionCaches,
  confirmOptimisticFinance,
  hydrateLastKnownFromPersist,
  lastAnalysSnapshot,
  lastAccountsSnapshot,
  paintableAccountsSnapshot,
  rememberAccountsSnapshot,
  rememberHomeSnapshot,
} from "@/features/home/last-snapshot";
import {
  applyQuietMenuBundleForTests,
  resetQuietMenuWarmForTests,
} from "@/lib/nav/quiet-menu-warm";

const route = readFileSync(new URL("./AnalysRouteClient.tsx", import.meta.url), "utf8");
const pending = readFileSync(
  new URL("../layout/ViewLoading.tsx", import.meta.url),
  "utf8",
);

const home = {
  userId: "user-hugo",
  displayName: "Hugo",
  timeZone: "Asia/Bangkok",
  primaryAccountId: "acc",
  currency: "THB",
  monthKey: "2026-09",
  monthLabelSv: "september",
  hasBankTruth: true,
  calculatedBalanceMinor: 10_000_00,
  verificationLabel: null,
  todaySpendingMinor: 200_00,
  todayPlannedPaidMinor: 0,
  monthSpendingMinor: 1_000_00,
  cycleSpendingMinor: 400_00,
  safeToSpendTodayMinor: 800_00,
  cycleStartLabelSv: "1 sep.",
  cycleEndLabelSv: "1 okt.",
  cycleEndInferred: false,
  cycleIsActive: true,
  livingMode: "cycle",
  needsAvailableInput: false,
  usesBankBalance: true,
  planIncomeMinor: 20_000_00,
  planExpenseMinor: 0,
  planSavingsMinor: 0,
  freeToSpendMinor: 20_000_00,
  remainingFreeMinor: 19_600_00,
  spendDaysLeft: 12,
  dayBudgetMinor: 1_000_00,
  remainingTodayMinor: 800_00,
  livingPoolMinor: 10_000_00,
  reservedUntilIncomeMinor: 0,
  daysUntilIncome: 12,
  nextIncomeLabelSv: null,
  extraSaldoMinor: 0,
  extraSaldoDrawnMinor: 0,
  extraSaldoHint: null,
  extraCarriedInMinor: 0,
  savingsTotalMinor: 0,
  wealthTotalMinor: 10_000_00,
  monthResultMinor: 0,
  incomingMinor: 0,
  unpaidMinor: 0,
  overMinor: 10_000_00,
  financeRevision: "rev-1",
  verifiedAt: "2026-09-19T05:00:00.000Z",
  truthStatus: "verified",
} as HomeSnapshot;

const staleAccounts: AccountsSnapshot = {
  accounts: [
    {
      id: "bb",
      name: "Bangkok Bank",
      institution: null,
      maskedIdentifier: null,
      kind: "thai_bank",
      kindLabelSv: "Thai-bank",
      currency: "THB",
      isDefault: true,
      isActive: true,
      calculatedMinor: 7_950_00,
      thbMinor: 7_950_00,
      fxRate: 1,
      fxSource: "identity",
    },
  ],
  archivedAccounts: [],
  totalThbMinor: 7_950_00,
};

const freshAccounts: AccountsSnapshot = {
  accounts: [
    {
      id: "bb",
      name: "Bangkok Bank",
      institution: null,
      maskedIdentifier: null,
      kind: "thai_bank",
      kindLabelSv: "Thai-bank",
      currency: "THB",
      isDefault: true,
      isActive: true,
      calculatedMinor: 3_231_95,
      thbMinor: 3_231_95,
      fxRate: 1,
      fxSource: "identity",
    },
    {
      id: "tm",
      name: "TrueMoney",
      institution: null,
      maskedIdentifier: null,
      kind: "other",
      kindLabelSv: "Annat",
      currency: "THB",
      isDefault: false,
      isActive: true,
      calculatedMinor: 190_00,
      thbMinor: 190_00,
      fxRate: 1,
      fxSource: "identity",
    },
  ],
  archivedAccounts: [],
  totalThbMinor: 3_421_95,
};

const quietPlan: PlanSnapshot = {
  items: [],
  currency: "THB",
  timeZone: "Asia/Bangkok",
  bankBalanceMinor: 3_421_95,
  spendingByMonthKey: { "2026-09": 200_00 },
  ledgerTransactions: [],
  accounts: freshAccounts,
  financeRevision: "quiet-plan-rev",
  verifiedAt: "2026-09-20T06:00:00.000Z",
  truthStatus: "verified",
};

function installMemoryStorage() {
  const map = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
      removeItem: (key: string) => {
        map.delete(key);
      },
    },
  });
  return map;
}

afterEach(() => {
  resetQuietMenuWarmForTests();
  clearClientSessionCaches();
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("Analys time-to-first-paint (not fetch-done)", () => {
  it("paints last-known / Hem-derived chrome without awaiting the action", () => {
    const body = route.slice(route.indexOf("export function AnalysRouteClient"));
    const viewIdx = body.indexOf("const view =");
    const fetchIdx = body.indexOf("fetchAnalysSnapshotClient");
    expect(viewIdx).toBeGreaterThan(-1);
    expect(fetchIdx).toBeGreaterThan(viewIdx);
    expect(route).toContain("if (ensurePaintableAnalysSnapshot()) return");
    expect(route).toContain("<AnalysDashboard data={view}");
    expect(route).not.toContain("waitForQuietMenuWarm");
    expect(route).not.toContain("await getAnalysSnapshotAction");
    expect(route).toContain("requestAnimationFrame");
  });

  it("writes paint-able last-known when Hem confirms — before Analys fetch", () => {
    expect(lastAnalysSnapshot()).toBeNull();
    rememberHomeSnapshot(home);
    expect(analysViewCanPaint(lastAnalysSnapshot())).toBe(true);
    expect(lastAnalysSnapshot()?.cycle.remainingFreeMinor).toBe(
      home.remainingFreeMinor,
    );
    expect(lastAnalysSnapshot()?.cycle.daysLeft).toBe(home.spendDaysLeft);
    const again = ensurePaintableAnalysSnapshot();
    expect(again?.cycle.remainingFreeMinor).toBe(home.remainingFreeMinor);
  });

  it("still paints last-known after Spec S drops stale Konton last-known", () => {
    rememberHomeSnapshot(home);
    rememberAccountsSnapshot({
      accounts: [
        {
          id: "bb",
          name: "Bangkok Bank",
          institution: null,
          maskedIdentifier: null,
          kind: "thai_bank",
          kindLabelSv: "Thai-bank",
          currency: "THB",
          isDefault: true,
          isActive: true,
          calculatedMinor: 7_950_00,
          thbMinor: 7_950_00,
          fxRate: 1,
          fxSource: "identity",
        },
      ],
      archivedAccounts: [],
      totalThbMinor: 7_950_00,
    });
    rememberHomeSnapshot({
      ...home,
      financeRevision: "hem-guard",
      verifiedAt: "2026-09-20T07:00:00.000Z",
    });
    expect(analysViewCanPaint(lastAnalysSnapshot())).toBe(true);
    expect(ensurePaintableAnalysSnapshot()?.month).toBeTruthy();
    expect(ensurePaintableAnalysSnapshot()?.currentMonthKey).toBeTruthy();
    expect(route).toContain("if (ensurePaintableAnalysSnapshot()) return");
    expect(route).not.toContain("waitForQuietMenuWarm");
  });

  it("cold session: Hem confirm + quiet-warm adopt leaves Analys last-known (no fetch)", () => {
    expect(lastAnalysSnapshot()).toBeNull();
    expect(lastAccountsSnapshot()).toBeNull();

    const hem = {
      ...home,
      calculatedBalanceMinor: 3_421_95,
      financeRevision: "hem-cold",
      verifiedAt: "2026-09-20T05:00:00.000Z",
    } as HomeSnapshot;
    rememberHomeSnapshot(hem);
    expect(analysViewCanPaint(lastAnalysSnapshot())).toBe(true);

    applyQuietMenuBundleForTests({
      ok: true,
      data: {
        plan: quietPlan,
        gettingStarted: null,
        analys: null,
        movements: null,
        accounts: staleAccounts,
      },
    });

    expect(analysViewCanPaint(lastAnalysSnapshot())).toBe(true);
    expect(ensurePaintableAnalysSnapshot()?.month).toBeTruthy();
    expect(ensurePaintableAnalysSnapshot()?.currentMonthKey).toBeTruthy();
    // Route client skips getAnalysSnapshotAction when last-known can paint.
    expect(Boolean(ensurePaintableAnalysSnapshot())).toBe(true);
    // Stale 7_950 must not win; Hem-aligned Plan accounts may gap-fill.
    expect(lastAccountsSnapshot()?.totalThbMinor).not.toBe(7_950_00);
    expect(paintableAccountsSnapshot()?.totalThbMinor).toBe(3_421_95);

    adoptAccountsLastKnown(staleAccounts);
    expect(paintableAccountsSnapshot()?.totalThbMinor).toBe(3_421_95);
    expect(analysViewCanPaint(lastAnalysSnapshot())).toBe(true);
    expect(Boolean(ensurePaintableAnalysSnapshot())).toBe(true);

    applyQuietMenuBundleForTests({
      ok: true,
      data: {
        plan: null,
        gettingStarted: null,
        analys: null,
        movements: null,
        accounts: staleAccounts,
      },
    });
    expect(paintableAccountsSnapshot()?.totalThbMinor).toBe(3_421_95);
    expect(analysViewCanPaint(lastAnalysSnapshot())).toBe(true);
  });

  it("stale-only quiet-warm adopt invalidates Konton but keeps Analys last-known", () => {
    rememberHomeSnapshot({
      ...home,
      calculatedBalanceMinor: 3_421_95,
      financeRevision: "hem-stale-only",
      verifiedAt: "2026-09-20T05:00:00.000Z",
    });
    expect(analysViewCanPaint(lastAnalysSnapshot())).toBe(true);
    applyQuietMenuBundleForTests({
      ok: true,
      data: {
        plan: null,
        gettingStarted: null,
        analys: null,
        movements: null,
        accounts: staleAccounts,
      },
    });
    expect(lastAccountsSnapshot()).toBeNull();
    expect(paintableAccountsSnapshot()).toBeNull();
    expect(analysViewCanPaint(lastAnalysSnapshot())).toBe(true);
    expect(Boolean(ensurePaintableAnalysSnapshot())).toBe(true);
  });

  it("cold persist: quota-empty Analys + stale Konton still paints after hydrate + confirm", () => {
    installMemoryStorage();
    const persist = {
      v: 1 as const,
      userId: home.userId,
      home: {
        ...home,
        calculatedBalanceMinor: 3_421_95,
        financeRevision: "hem-persist",
        verifiedAt: "2026-09-20T05:00:00.000Z",
      },
      plan: { ...quietPlan, financeRevision: "plan-persist" },
      analys: null,
      mer: null,
      accounts: staleAccounts,
      movements: null,
      gettingStarted: null,
      planView: null,
      analysScope: null,
      movementsView: null,
    };
    writePersistedLastKnown(persist);
    clearClientSessionCaches();
    expect(lastAnalysSnapshot()).toBeNull();
    writePersistedLastKnown(persist);
    hydrateLastKnownFromPersist();

    expect(lastAccountsSnapshot()).toBeNull();
    expect(paintableAccountsSnapshot()).toBeNull();
    expect(analysViewCanPaint(lastAnalysSnapshot())).toBe(true);

    rememberHomeSnapshot({
      ...home,
      calculatedBalanceMinor: 3_421_95,
      financeRevision: "hem-persist-confirm",
      verifiedAt: "2026-09-20T06:00:00.000Z",
    });
    applyQuietMenuBundleForTests({
      ok: true,
      data: {
        plan: quietPlan,
        gettingStarted: null,
        analys: null,
        movements: null,
        accounts: staleAccounts,
      },
    });
    expect(analysViewCanPaint(lastAnalysSnapshot())).toBe(true);
    expect(Boolean(ensurePaintableAnalysSnapshot())).toBe(true);
    expect(lastAccountsSnapshot()?.totalThbMinor).not.toBe(7_950_00);
    expect(paintableAccountsSnapshot()?.totalThbMinor).toBe(3_421_95);
  });

  it("confirmOptimisticFinance does not leave Analys empty after a verified Hem", () => {
    rememberHomeSnapshot(home);
    expect(analysViewCanPaint(lastAnalysSnapshot())).toBe(true);
    confirmOptimisticFinance();
    expect(analysViewCanPaint(lastAnalysSnapshot())).toBe(true);
    expect(Boolean(ensurePaintableAnalysSnapshot())).toBe(true);
  });

  it("keeps Perioden / Månad chrome on the empty shell", () => {
    const pendingFn = pending.slice(
      pending.indexOf("export function AnalysPending"),
      pending.indexOf("export function AnalysViewLoading"),
    );
    expect(pendingFn).toContain("SV.perioden");
    expect(pendingFn).toContain("SV.manad");
    expect(pendingFn).toContain("data-numa-view-loading");
  });
});
