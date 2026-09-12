import { beforeEach, describe, expect, it } from "vitest";
import type { CanonicalTransaction } from "@/domain/finance";
import type { HomeSnapshot } from "@/features/finance/load-home";
import type { MovementsSnapshot } from "@/features/finance/load-movements";
import {
  applyAccountBalance,
  applyLocalTransfer,
  applyMovementsEdit,
  applyMovementsVoid,
  applyOptimisticHomeSpend,
  applyOptimisticPlanSettle,
  lastAccountsSnapshot,
  lastAnalysScope,
  lastFotaBoot,
  lastHomeSnapshot,
  lastImporteraRows,
  lastMerSnapshot,
  lastMovementsSnapshot,
  lastMovementsView,
  lastPlanSnapshot,
  lastPlanView,
  lastSettingsSnapshot,
  lastKnownChromeDisplayName,
  hasBoundSessionOwner,
  clearClientSessionCaches,
  hydrateLastKnownFromPersist,
  invalidateHomeSessionPaint,
  isHomeSessionConfirmed,
  enableHomeLoginShell,
  lastHomeShellSnapshot,
  lastSessionHomeSnapshot,
  rememberAccountsSnapshot,
  rememberAnalysScope,
  rememberFotaBoot,
  rememberHomeSnapshot,
  rememberImporteraRows,
  rememberMerSnapshot,
  rememberMovementsSnapshot,
  rememberMovementsView,
  rememberPlanSnapshot,
  rememberPlanView,
  rememberSettingsSnapshot,
  revertOptimisticHomeSpend,
  subscribeHomeSnapshot,
  syncHomeCoverageFromPlan,
  syncHomeLivingFromPlan,
} from "./last-snapshot";
import { serializeLastHomeCookie } from "./last-home-cookie";

const sampleMovements: MovementsSnapshot = {
  currency: "THB",
  hasBankTruth: true,
  balanceMinor: 100_00,
  monthIncomeMinor: 0,
  monthExpenseMinor: 0,
  monthNetMinor: 0,
  allIncomeMinor: 0,
  allExpenseMinor: 0,
  allNetMinor: 0,
  monthCategories: [],
  items: [],
  timeZone: "Asia/Bangkok",
  monthKey: "2026-08",
};

function accountRow(
  partial: Partial<{
    id: string;
    name: string;
    institution: string | null;
    maskedIdentifier: string | null;
    currency: "THB" | "SEK" | "EUR" | "USD";
    isDefault: boolean;
    calculatedMinor: number | null;
    thbMinor: number | null;
    fxRate: number | null;
  }> = {},
) {
  const calculatedMinor = partial.calculatedMinor ?? 100_00;
  const currency = partial.currency ?? "THB";
  return {
    id: partial.id ?? "a1",
    name: partial.name ?? "Bangkok Bank",
    institution: partial.institution ?? "Bangkok Bank",
    maskedIdentifier: partial.maskedIdentifier ?? "6591",
    kind: "thai_bank" as const,
    kindLabelSv: "Thai-bank",
    currency,
    isDefault: partial.isDefault ?? true,
    isActive: true,
    calculatedMinor,
    thbMinor: partial.thbMinor ?? (currency === "THB" ? calculatedMinor : null),
    fxRate:
      partial.fxRate !== undefined
        ? partial.fxRate
        : currency === "THB"
          ? 1
          : null,
    fxSource: currency === "THB" ? "identity" : null,
  };
}

function homeSnap(partial: Partial<HomeSnapshot> = {}): HomeSnapshot {
  return {
    userId: "user-hugo",
    displayName: "Hugo",
    timeZone: "Asia/Bangkok",
    primaryAccountId: "acc",
    currency: "THB",
    monthKey: "2026-08",
    monthLabelSv: "augusti",
    hasBankTruth: true,
    calculatedBalanceMinor: 10_000_00,
    verificationLabel: null,
    todaySpendingMinor: 200_00,
    todayPlannedPaidMinor: 0,
    monthSpendingMinor: 1_000_00,
    cycleSpendingMinor: 400_00,
    safeToSpendTodayMinor: 800_00,
    cycleStartLabelSv: null,
    cycleEndLabelSv: null,
    cycleEndInferred: false,
    cycleIsActive: true,
    livingMode: "cycle",
    needsAvailableInput: false,
    usesBankBalance: true,
    planIncomeMinor: 20_000_00,
    planExpenseMinor: 8_000_00,
    planSavingsMinor: 0,
    freeToSpendMinor: 12_000_00,
    remainingFreeMinor: 11_600_00,
    spendDaysLeft: 10,
    dayBudgetMinor: 1_000_00,
    remainingTodayMinor: 800_00,
    daysUntilIncome: 10,
    nextIncomeLabelSv: null,
    extraSaldoMinor: 0,
    extraSaldoDrawnMinor: 0,
    extraSaldoHint: null,
    extraCarriedInMinor: 0,
    savingsTotalMinor: 2_000_00,
    wealthTotalMinor: 14_000_00,
    monthResultMinor: 0,
    incomingMinor: 5_000_00,
    unpaidMinor: 3_000_00,
    overMinor: 12_000_00,
    ...partial,
    financeRevision: partial.financeRevision ?? "test-rev",
    verifiedAt: partial.verifiedAt ?? "2026-08-26T05:00:00.000Z",
    truthStatus: partial.truthStatus ?? "verified",
  };
}

describe("last view memory", () => {
  beforeEach(() => {
    clearClientSessionCaches();
  });

  it("keeps Plan month and Analys scope across remounts", () => {
    rememberPlanView({ monthKey: "2027-03", viewYear: 2027 });
    rememberAnalysScope("month");
    expect(lastPlanView()).toEqual({ monthKey: "2027-03", viewYear: 2027 });
    expect(lastAnalysScope()).toBe("month");
  });

  it("notifies Hem when a spend lands before the server round-trip", () => {
    rememberHomeSnapshot(homeSnap());
    let ticks = 0;
    const stop = subscribeHomeSnapshot(() => {
      ticks += 1;
    });
    applyOptimisticHomeSpend(150_00);
    const next = lastHomeSnapshot();
    expect(next?.todaySpendingMinor).toBe(350_00);
    expect(next?.remainingTodayMinor).toBe(650_00);
    expect(next?.calculatedBalanceMinor).toBe(9_850_00);
    expect(next?.overMinor).toBe(9_850_00 + 5_000_00 - 3_000_00);
    expect(ticks).toBeGreaterThan(0);
    revertOptimisticHomeSpend(150_00);
    expect(lastHomeSnapshot()?.todaySpendingMinor).toBe(200_00);
    expect(lastHomeSnapshot()?.overMinor).toBe(12_000_00);
    stop();
  });

  it("moves Hem saldo with Mottagen and keeps Över still", () => {
    rememberHomeSnapshot(
      homeSnap({
        calculatedBalanceMinor: 10_000_00,
        incomingMinor: 57_000_00,
        unpaidMinor: 0,
        overMinor: 67_000_00,
      }),
    );
    applyOptimisticPlanSettle({
      saldoDeltaMinor: 57_000_00,
      incomingDeltaMinor: -57_000_00,
      unpaidDeltaMinor: 0,
    });
    const next = lastHomeSnapshot();
    expect(next?.calculatedBalanceMinor).toBe(67_000_00);
    expect(next?.incomingMinor).toBe(0);
    expect(next?.overMinor).toBe(67_000_00);
  });

  it("keeps Över as saldo + kommer in − kvar att betala when Plan settles", () => {
    rememberHomeSnapshot(
      homeSnap({
        calculatedBalanceMinor: 8_000_00,
        incomingMinor: 2_000_00,
        unpaidMinor: 4_000_00,
        overMinor: 6_000_00,
      }),
    );
    syncHomeCoverageFromPlan({
      items: [
        {
          id: "bill-1",
          userId: "u1",
          name: "Hyra",
          kind: "mandatory",
          amountMinor: 1_000_00,
          currency: "THB",
          cadence: "monthly",
          nextDueAt: "2026-08-05T12:00:00.000Z",
          isActive: true,
          settledAt: "2026-08-02T12:00:00.000Z",
          settledMinor: 1_000_00,
          remainingDueAt: null,
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-02T12:00:00.000Z",
        },
      ],
      currency: "THB",
      timeZone: "Asia/Bangkok",
      bankBalanceMinor: 8_000_00,
      spendingByMonthKey: {},
      ledgerTransactions: [],
      financeRevision: "test-rev",
      verifiedAt: "2026-08-26T05:00:00.000Z",
      truthStatus: "verified",
    });
    const next = lastHomeSnapshot();
    expect(next?.unpaidMinor).toBe(0);
    expect(next?.overMinor).toBe(8_000_00 + (next?.incomingMinor ?? 0) - 0);
  });

  it("keeps last-known Plan rows so the editor can paint without waiting", () => {
    rememberPlanSnapshot({
      items: [],
      currency: "THB",
      timeZone: "Asia/Bangkok",
      bankBalanceMinor: 10_000_00,
      spendingByMonthKey: {},
      ledgerTransactions: [],
      financeRevision: "test-rev",
      verifiedAt: "2026-08-26T05:00:00.000Z",
      truthStatus: "verified",
    });
    expect(lastPlanSnapshot()?.bankBalanceMinor).toBe(10_000_00);
    expect(lastPlanSnapshot()?.currency).toBe("THB");
  });

  it("keeps Rörelser, Saldo, Mer, Fota, Importera and Inställningar", () => {
    rememberMovementsSnapshot(sampleMovements);
    rememberMovementsView({ filter: "expense", period: "all" });
    rememberAccountsSnapshot({
      accounts: [accountRow()],
      archivedAccounts: [],
      totalThbMinor: 100_00,
    });
    rememberMerSnapshot({
      userId: "user-hugo",
      displayName: "Christian",
      isAdmin: false,
    });
    rememberFotaBoot({
      accountId: "a1",
      accounts: [{ id: "a1", name: "Bangkok Bank", accountType: "checking" }],
      remainingTodayMinor: 250_00,
      currency: "THB",
      bootstrapping: false,
    });
    rememberImporteraRows([
      {
        id: "obs-1",
        kind: "receipt",
        status: "processed",
        createdAt: "2026-08-01T00:00:00.000Z",
        notes: null,
      },
    ]);
    rememberSettingsSnapshot({
      userId: "user-hugo",
      displayName: "Christian",
      timezone: "Asia/Bangkok",
      primaryCurrency: "THB",
      supabaseReady: true,
      isAdmin: false,
    });

    expect(lastMovementsSnapshot()?.balanceMinor).toBe(100_00);
    expect(lastMovementsView()).toEqual({ filter: "expense", period: "all" });
    expect(lastAccountsSnapshot()?.accounts[0]?.name).toBe("Bangkok Bank");
    expect(lastMerSnapshot()?.displayName).toBe("Christian");
    expect(lastFotaBoot()?.remainingTodayMinor).toBe(250_00);
    expect(lastImporteraRows()?.[0]?.id).toBe("obs-1");
    expect(lastSettingsSnapshot()?.timezone).toBe("Asia/Bangkok");
  });

  it("voids a Rörelser expense locally without waiting for RSC", () => {
    rememberHomeSnapshot(homeSnap({ calculatedBalanceMinor: 100_00 }));
    rememberMovementsSnapshot({
      ...sampleMovements,
      balanceMinor: 100_00,
      monthExpenseMinor: 20_00,
      monthNetMinor: -20_00,
      allExpenseMinor: 20_00,
      allNetMinor: -20_00,
      monthCategories: [{ name: "Mat", amountMinor: 20_00, count: 1 }],
      items: [
        {
          id: "tx1",
          description: "Lunch",
          category: "Mat",
          transactionType: "expense",
          direction: "debit",
          amountMinor: 20_00,
          currency: "THB",
          nativeAmountMinor: 20_00,
          nativeCurrency: "THB",
          occurredAt: "2026-08-10T12:00:00.000Z",
          source: "manual",
        },
      ],
    });
    rememberAccountsSnapshot({
      accounts: [accountRow({ id: "acc", calculatedMinor: 100_00 })],
      totalThbMinor: 100_00,
    });

    applyMovementsVoid("tx1");

    expect(lastMovementsSnapshot()?.items).toEqual([]);
    expect(lastMovementsSnapshot()?.monthExpenseMinor).toBe(0);
    expect(lastMovementsSnapshot()?.balanceMinor).toBe(120_00);
    expect(lastAccountsSnapshot()?.accounts[0]?.calculatedMinor).toBe(120_00);
    expect(lastHomeSnapshot()?.calculatedBalanceMinor).toBe(120_00);
    expect(lastHomeSnapshot()?.todaySpendingMinor).toBe(200_00);
  });

  it("moves kvar idag only when the voided expense is from today", () => {
    rememberHomeSnapshot(homeSnap({ calculatedBalanceMinor: 100_00 }));
    rememberMovementsSnapshot({
      ...sampleMovements,
      balanceMinor: 100_00,
      monthExpenseMinor: 20_00,
      monthNetMinor: -20_00,
      allExpenseMinor: 20_00,
      allNetMinor: -20_00,
      items: [
        {
          id: "tx-today",
          description: "Fika",
          category: "Mat",
          transactionType: "expense",
          direction: "debit",
          amountMinor: 20_00,
          currency: "THB",
          nativeAmountMinor: 20_00,
          nativeCurrency: "THB",
          occurredAt: new Date().toISOString(),
          source: "manual",
        },
      ],
    });

    applyMovementsVoid("tx-today");

    expect(lastHomeSnapshot()?.calculatedBalanceMinor).toBe(120_00);
    expect(lastHomeSnapshot()?.todaySpendingMinor).toBe(180_00);
    expect(lastHomeSnapshot()?.remainingTodayMinor).toBe(820_00);
  });

  it("edits a Rörelser expense amount and description locally", () => {
    rememberHomeSnapshot(homeSnap({ calculatedBalanceMinor: 100_00 }));
    rememberMovementsSnapshot({
      ...sampleMovements,
      balanceMinor: 100_00,
      monthExpenseMinor: 20_00,
      monthNetMinor: -20_00,
      allExpenseMinor: 20_00,
      allNetMinor: -20_00,
      monthCategories: [{ name: "Mat", amountMinor: 20_00, count: 1 }],
      items: [
        {
          id: "tx1",
          description: "Lunch",
          category: "Mat",
          transactionType: "expense",
          direction: "debit",
          amountMinor: 20_00,
          currency: "THB",
          nativeAmountMinor: 20_00,
          nativeCurrency: "THB",
          occurredAt: "2026-08-10T12:00:00.000Z",
          source: "manual",
        },
      ],
    });

    applyMovementsEdit("tx1", {
      amountMinor: 35_00,
      description: "Middag",
      category: "Mat",
    });

    const next = lastMovementsSnapshot();
    expect(next?.items[0]?.description).toBe("Middag");
    expect(next?.items[0]?.amountMinor).toBe(35_00);
    expect(next?.monthExpenseMinor).toBe(35_00);
    expect(next?.balanceMinor).toBe(85_00);
    expect(lastHomeSnapshot()?.calculatedBalanceMinor).toBe(85_00);
  });

  it("writes a new saldo into Konton and Hem immediately", () => {
    rememberHomeSnapshot(homeSnap({ calculatedBalanceMinor: 100_00 }));
    rememberAccountsSnapshot({
      accounts: [accountRow({ calculatedMinor: 100_00 })],
      totalThbMinor: 100_00,
    });
    rememberMovementsSnapshot(sampleMovements);

    applyAccountBalance("a1", 250_00);

    expect(lastAccountsSnapshot()?.accounts[0]?.calculatedMinor).toBe(250_00);
    expect(lastHomeSnapshot()?.calculatedBalanceMinor).toBe(250_00);
    expect(lastMovementsSnapshot()?.balanceMinor).toBe(250_00);
  });

  it("does not treat a bare EUR verify as THB on Hem", () => {
    rememberHomeSnapshot(homeSnap({ calculatedBalanceMinor: 15_800_00 }));
    rememberAccountsSnapshot({
      accounts: [
        accountRow({
          id: "eur",
          currency: "EUR",
          calculatedMinor: 100_00,
          thbMinor: 3_800_00,
          fxRate: 38,
        }),
        accountRow({
          id: "thai",
          currency: "THB",
          calculatedMinor: 12_000_00,
          thbMinor: 12_000_00,
        }),
      ],
      totalThbMinor: 15_800_00,
    });

    applyAccountBalance("eur", 90_00, { currency: "EUR" });

    const accounts = lastAccountsSnapshot();
    expect(accounts?.accounts.find((a) => a.id === "eur")?.thbMinor).toBe(
      3_420_00,
    );
    expect(accounts?.totalThbMinor).toBe(15_420_00);
    expect(lastHomeSnapshot()?.calculatedBalanceMinor).toBe(15_420_00);
  });

  it("does not shrink Hem Σ THB on a same-currency wallet move", () => {
    rememberHomeSnapshot(
      homeSnap({
        primaryAccountId: "acc-a",
        calculatedBalanceMinor: 1_200_00,
      }),
    );
    rememberAccountsSnapshot({
      accounts: [
        accountRow({
          id: "acc-a",
          isDefault: true,
          calculatedMinor: 1_000_00,
          thbMinor: 1_000_00,
        }),
        accountRow({
          id: "acc-b",
          name: "Kontanter",
          isDefault: false,
          calculatedMinor: 200_00,
          thbMinor: 200_00,
        }),
      ],
      totalThbMinor: 1_200_00,
    });

    applyLocalTransfer({
      fromAccountId: "acc-a",
      toAccountId: "acc-b",
      amountMinor: 100_00,
    });

    expect(lastAccountsSnapshot()?.accounts[0]?.calculatedMinor).toBe(900_00);
    expect(lastAccountsSnapshot()?.accounts[1]?.calculatedMinor).toBe(300_00);
    expect(lastAccountsSnapshot()?.totalThbMinor).toBe(1_200_00);
    expect(lastHomeSnapshot()?.calculatedBalanceMinor).toBe(1_200_00);

    applyLocalTransfer({
      fromAccountId: "acc-a",
      toAccountId: "acc-b",
      amountMinor: 100_00,
    });
    expect(lastAccountsSnapshot()?.accounts[0]?.calculatedMinor).toBe(800_00);
    expect(lastAccountsSnapshot()?.accounts[1]?.calculatedMinor).toBe(400_00);
  });

  it("lets kvar idag go negative when spend passes the sticky dagsbudget", () => {
    rememberHomeSnapshot(
      homeSnap({
        todaySpendingMinor: 900_00,
        remainingTodayMinor: 100_00,
        dayBudgetMinor: 1_000_00,
      }),
    );
    applyOptimisticHomeSpend(250_00);
    expect(lastHomeSnapshot()?.todaySpendingMinor).toBe(1_150_00);
    expect(lastHomeSnapshot()?.remainingTodayMinor).toBe(-150_00);
    expect(lastHomeSnapshot()?.remainingTodayMinor).not.toBe(0);
  });

  it("rebuilds kvar idag from a new bridge saldo instead of leaving 0", () => {
    rememberHomeSnapshot(
      homeSnap({
        livingMode: "bridge",
        needsAvailableInput: true,
        usesBankBalance: false,
        calculatedBalanceMinor: null,
        todaySpendingMinor: 0,
        dayBudgetMinor: 0,
        remainingTodayMinor: 0,
        spendDaysLeft: 10,
      }),
    );
    applyAccountBalance("acc", 10_000_00);
    const next = lastHomeSnapshot();
    expect(next?.needsAvailableInput).toBe(false);
    expect(next?.dayBudgetMinor).toBe(1_000_00);
    expect(next?.remainingTodayMinor).toBe(1_000_00);
    expect(next?.overMinor).toBe(10_000_00 + 5_000_00 - 3_000_00);
  });

  it("drops Hugo's last-known numbers when another user binds", () => {
    rememberHomeSnapshot(homeSnap({ calculatedBalanceMinor: 99_000_00 }));
    expect(lastHomeSnapshot()?.displayName).toBe("Hugo");
    rememberMerSnapshot({
      userId: "user-christian",
      displayName: "Christian Hultz",
      isAdmin: false,
    });
    expect(lastHomeSnapshot()).toBeNull();
    expect(lastMerSnapshot()?.displayName).toBe("Christian Hultz");
    expect(lastKnownChromeDisplayName()).toBe("Christian Hultz");
    clearClientSessionCaches();
    expect(hasBoundSessionOwner()).toBe(false);
    expect(lastKnownChromeDisplayName()).toBeNull();
    expect(lastMerSnapshot()).toBeNull();
  });

  it("rehydrates last-known Hem after a cold client boot", async () => {
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
    rememberHomeSnapshot(homeSnap({ remainingTodayMinor: 640_00 }));
    await Promise.resolve();
    const raw = map.get("numa.lastKnown.v1");
    expect(raw).toContain("640");
    clearClientSessionCaches();
    expect(lastHomeSnapshot()).toBeNull();
    if (raw) map.set("numa.lastKnown.v1", raw);
    hydrateLastKnownFromPersist();
    expect(lastHomeSnapshot()?.remainingTodayMinor).toBe(640_00);
    expect(lastSessionHomeSnapshot()).toBeNull();
    expect(isHomeSessionConfirmed()).toBe(false);
    expect(lastKnownChromeDisplayName()).toBe("Hugo");
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("does not paint hydrate/cookie Hem as live until a session remember", async () => {
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
    rememberHomeSnapshot(
      homeSnap({ unpaidMinor: 120_00, overMinor: 108_167_00 }),
    );
    expect(lastSessionHomeSnapshot()?.unpaidMinor).toBe(120_00);
    await Promise.resolve();
    // Simulate persist write + cold reopen.
    const raw = map.get("numa.lastKnown.v1");
    expect(raw).toContain("120");
    clearClientSessionCaches();
    if (raw) map.set("numa.lastKnown.v1", raw);
    hydrateLastKnownFromPersist();
    expect(lastHomeSnapshot()?.unpaidMinor).toBe(120_00);
    // Provisional shell OK for Christian-bar warm reopen — not live confirm.
    expect(lastSessionHomeSnapshot()).toBeNull();
    expect(lastHomeShellSnapshot()?.unpaidMinor).toBe(120_00);

    invalidateHomeSessionPaint();
    expect(lastSessionHomeSnapshot()).toBeNull();
    expect(lastHomeShellSnapshot()?.unpaidMinor).toBe(120_00);

    rememberHomeSnapshot(
      homeSnap({ unpaidMinor: 0, overMinor: 108_287_00 }),
    );
    expect(lastSessionHomeSnapshot()?.unpaidMinor).toBe(0);
    expect(lastSessionHomeSnapshot()?.overMinor).toBe(108_287_00);
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("login invalidate keeps memory but blocks confirmed Hem until fetch", () => {
    rememberHomeSnapshot(
      homeSnap({ unpaidMinor: 120_00, overMinor: 108_167_00 }),
    );
    expect(isHomeSessionConfirmed()).toBe(true);
    invalidateHomeSessionPaint();
    expect(lastHomeSnapshot()?.unpaidMinor).toBe(120_00);
    expect(lastSessionHomeSnapshot()).toBeNull();
    // confirm cleared homeLoginShell on remember; enable again for shell.
    expect(lastHomeShellSnapshot()).toBeNull();
    enableHomeLoginShell();
    expect(lastSessionHomeSnapshot()).toBeNull();
    expect(lastHomeShellSnapshot()?.unpaidMinor).toBe(120_00);
    rememberHomeSnapshot(
      homeSnap({ unpaidMinor: 0, overMinor: 108_287_00 }),
    );
    expect(lastSessionHomeSnapshot()?.overMinor).toBe(108_287_00);
    expect(lastHomeShellSnapshot()?.overMinor).toBe(108_287_00);
  });

  it("warm hydrate enables provisional Hem shell but not live confirm", async () => {
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
    rememberHomeSnapshot(
      homeSnap({ unpaidMinor: 120_00, overMinor: 108_167_00 }),
    );
    await Promise.resolve();
    const raw = map.get("numa.lastKnown.v1");
    expect(raw).toContain("120");
    clearClientSessionCaches();
    if (raw) map.set("numa.lastKnown.v1", raw);
    hydrateLastKnownFromPersist();
    expect(lastHomeSnapshot()?.unpaidMinor).toBe(120_00);
    expect(lastSessionHomeSnapshot()).toBeNull();
    expect(isHomeSessionConfirmed()).toBe(false);
    expect(lastHomeShellSnapshot()?.unpaidMinor).toBe(120_00);
    expect(lastHomeShellSnapshot()?.overMinor).toBe(108_167_00);
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("fills Hem from the cookie when persist has no home", () => {
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
    map.set(
      "numa.lastKnown.v1",
      JSON.stringify({
        v: 1,
        userId: "user-test",
        home: null,
        plan: null,
        analys: null,
        mer: null,
        accounts: null,
        movements: null,
        gettingStarted: null,
        planView: null,
        analysScope: null,
        movementsView: null,
      }),
    );
    const encoded = serializeLastHomeCookie(
      homeSnap({ remainingTodayMinor: 333_00, displayName: "Test" }),
    );
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { cookie: `numa.lastHome.v1=${encoded}` },
    });
    hydrateLastKnownFromPersist();
    expect(lastHomeSnapshot()?.remainingTodayMinor).toBe(333_00);
    expect(lastHomeSnapshot()?.displayName).toBe("Test");
    expect(lastSessionHomeSnapshot()).toBeNull();
    Reflect.deleteProperty(globalThis, "localStorage");
    Reflect.deleteProperty(globalThis, "document");
  });

  it("force-adopts a mutation snapshot even when verifiedAt is older", () => {
    rememberHomeSnapshot(
      homeSnap({
        todaySpendingMinor: 21_200_00,
        todayPlannedPaidMinor: 20_000_00,
        financeRevision: "old",
        verifiedAt: "2026-09-04T08:00:02.000Z",
      }),
      { dirty: true },
    );
    const server = homeSnap({
      todaySpendingMinor: 1_200_00,
      todayPlannedPaidMinor: 20_000_00,
      remainingTodayMinor: 1_400_00,
      financeRevision: "new",
      verifiedAt: "2026-09-04T08:00:01.000Z",
    });
    rememberHomeSnapshot(server);
    expect(lastHomeSnapshot()?.todaySpendingMinor).toBe(21_200_00);
    rememberHomeSnapshot(server, { force: true });
    expect(lastHomeSnapshot()?.todaySpendingMinor).toBe(1_200_00);
    expect(lastHomeSnapshot()?.todayPlannedPaidMinor).toBe(20_000_00);
  });

  it("does not treat an unclassified settle as Spenderat idag", () => {
    rememberHomeSnapshot(
      homeSnap({
        todaySpendingMinor: 1_200_00,
        todayPlannedPaidMinor: 20_000_00,
        remainingTodayMinor: 1_428_00,
        dayBudgetMinor: 2_628_00,
        financeRevision: "after-settle",
        verifiedAt: "2026-09-04T08:00:00.000Z",
      }),
      { dirty: true },
    );
    const lunch: CanonicalTransaction = {
      id: "lunch",
      userId: "user-hugo",
      accountId: "acc",
      counterAccountId: null,
      direction: "debit",
      transactionType: "expense",
      amountMinor: 1_200_00,
      currency: "THB",
      occurredAt: new Date().toISOString(),
      description: "Lunch",
      merchant: null,
      category: "Mat",
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const settle: CanonicalTransaction = {
      ...lunch,
      id: "hyra",
      amountMinor: 20_000_00,
      description: "Hyra",
      category: null,
      ledgerOrigin: undefined,
      planItemId: null,
    };
    syncHomeLivingFromPlan({
      items: [],
      currency: "THB",
      timeZone: "Asia/Bangkok",
      bankBalanceMinor: 34_000_00,
      spendingByMonthKey: {},
      ledgerTransactions: [lunch, settle],
      financeRevision: "after-settle:local",
      verifiedAt: "2026-09-04T08:00:01.000Z",
      truthStatus: "stale",
    });
    expect(lastHomeSnapshot()?.todaySpendingMinor).toBe(1_200_00);
    expect(lastHomeSnapshot()?.todayPlannedPaidMinor).toBe(20_000_00);
  });

  it("never lets a Plan ledger raise Spenderat idag", () => {
    rememberHomeSnapshot(
      homeSnap({
        todaySpendingMinor: 1_200_00,
        todayPlannedPaidMinor: 0,
        remainingTodayMinor: 1_428_00,
        dayBudgetMinor: 2_628_00,
        financeRevision: "pre-settle",
        verifiedAt: "2026-09-04T08:00:00.000Z",
      }),
    );
    const lunch: CanonicalTransaction = {
      id: "lunch",
      userId: "user-hugo",
      accountId: "acc",
      counterAccountId: null,
      direction: "debit",
      transactionType: "expense",
      amountMinor: 1_200_00,
      currency: "THB",
      occurredAt: new Date().toISOString(),
      description: "Lunch",
      merchant: null,
      category: "Mat",
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    syncHomeLivingFromPlan({
      items: [],
      currency: "THB",
      timeZone: "Asia/Bangkok",
      bankBalanceMinor: 34_000_00,
      spendingByMonthKey: {},
      ledgerTransactions: [
        lunch,
        {
          ...lunch,
          id: "hyra",
          amountMinor: 20_000_00,
          description: "Hyra",
          category: null,
          ledgerOrigin: undefined,
          planItemId: null,
        },
      ],
      financeRevision: "pre-settle:local",
      verifiedAt: "2026-09-04T08:00:01.000Z",
      truthStatus: "stale",
    });
    expect(lastHomeSnapshot()?.todaySpendingMinor).toBe(1_200_00);
    expect(lastHomeSnapshot()?.todaySpendingMinor).not.toBe(21_200_00);
  });
});
