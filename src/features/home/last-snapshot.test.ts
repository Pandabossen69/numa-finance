import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalTransaction, PlanItem } from "@/domain/finance";
import { analysSnapshotHasDatapaint } from "@/features/finance/analys-from-known";
import { analysViewCanPaint } from "@/features/finance/analys-client-fetch";
import { upgradeAnalysFromPlanNow } from "@/features/finance/ensure-analys-last-known";
import type { HomeSnapshot } from "@/features/finance/load-home";
import type { PlanSnapshot } from "@/features/finance/load-plan";
import type { MovementsSnapshot } from "@/features/finance/load-movements";
import {
  applyAccountBalance,
  captureOptimisticBalance,
  undoOptimisticBalance,
  applyLocalTransfer,
  applyMovementsEdit,
  applyMovementsVoid,
  applyOptimisticHomeSpend,
  applyOptimisticPlanSettle,
  lastAccountsSnapshot,
  lastAnalysSnapshot,
  paintableAccountsSnapshot,
  lastAnalysScope,
  lastFotaBoot,
  lastHomeSnapshot,
  lastImporteraRows,
  lastMerSnapshot,
  ensurePaintableMerSnapshot,
  lastMovementsSnapshot,
  lastMovementsView,
  lastPlanSnapshot,
  lastPlanView,
  lastSettingsSnapshot,
  lastKnownChromeDisplayName,
  hasBoundSessionOwner,
  bindSessionOwner,
  clearClientSessionCaches,
  hydrateLastKnownFromPersist,
  invalidateHomeSessionPaint,
  isHomeSessionConfirmed,
  lastKnownHomeShell,
  lastSessionHomeSnapshot,
  adoptAccountsLastKnown,
  rememberAccountsSnapshot,
  rememberAnalysSnapshot,
  rememberAnalysScope,
  rememberFotaBoot,
  isLeftoverSparLivingRevert,
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
    livingPoolMinor: 10_000_00,
    reservedUntilIncomeMinor: 0,
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

  afterEach(() => {
    vi.useRealTimers();
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
    expect(next?.overMinor).toBe(9_850_00 + 5_000_00 - 3_000_00 - 2_000_00);
    expect(ticks).toBeGreaterThan(0);
    revertOptimisticHomeSpend(150_00);
    expect(lastHomeSnapshot()?.todaySpendingMinor).toBe(200_00);
    expect(lastHomeSnapshot()?.overMinor).toBe(10_000_00 + 5_000_00 - 3_000_00 - 2_000_00);
    stop();
  });

  it("writes numa.lastHome.v1 when Hem remembers real totals (SPEC 6b)", () => {
    let jar = "";
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        get cookie() {
          return jar;
        },
        set cookie(next: string) {
          const [pair] = next.split(";");
          const eq = pair.indexOf("=");
          const name = pair.slice(0, eq);
          const value = pair.slice(eq + 1);
          if (next.includes("Max-Age=0")) {
            jar = jar
              .split("; ")
              .filter((part) => part && !part.startsWith(`${name}=`))
              .join("; ");
            return;
          }
          const rest = jar
            .split("; ")
            .filter((part) => part && !part.startsWith(`${name}=`));
          rest.push(`${name}=${value}`);
          jar = rest.join("; ");
        },
      },
    });
    rememberHomeSnapshot(homeSnap({ remainingTodayMinor: 640_00 }));
    expect(document.cookie).toContain("numa.lastHome.v1=");
    expect(document.cookie).toContain("64000");
    Reflect.deleteProperty(globalThis, "document");
  });

  it("moves Hem saldo with Mottagen and keeps Över still", () => {
    rememberHomeSnapshot(
      homeSnap({
        calculatedBalanceMinor: 10_000_00,
        incomingMinor: 57_000_00,
        unpaidMinor: 0,
        overMinor: 65_000_00,
        savingsTotalMinor: 2_000_00,
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
    expect(next?.overMinor).toBe(67_000_00 - 2_000_00);
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
    rememberMovementsView({
      filter: "expense",
      period: "all",
      category: "Mat",
    });
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
    expect(lastMovementsView()).toEqual({
      filter: "expense",
      period: "all",
      category: "Mat",
    });
    expect(lastAccountsSnapshot()?.accounts[0]?.name).toBe("Bangkok Bank");
    expect(lastMerSnapshot()?.displayName).toBe("Christian");
    expect(lastFotaBoot()?.remainingTodayMinor).toBe(250_00);
    expect(lastImporteraRows()?.[0]?.id).toBe("obs-1");
    expect(lastSettingsSnapshot()?.timezone).toBe("Asia/Bangkok");
  });

  it("gap-fills Mer hub last-known from Hem so first paint is not MerViewLoading", () => {
    expect(lastMerSnapshot()).toBeNull();
    rememberHomeSnapshot(homeSnap());
    expect(lastMerSnapshot()?.userId).toBe("user-hugo");
    expect(lastMerSnapshot()?.displayName).toBe("Hugo");
    expect(lastMerSnapshot()?.isAdmin).toBe(false);
    expect(ensurePaintableMerSnapshot()?.displayName).toBe("Hugo");
    rememberMerSnapshot({
      userId: "user-hugo",
      displayName: "Hugo",
      isAdmin: true,
    });
    expect(ensurePaintableMerSnapshot()?.isAdmin).toBe(true);
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

  it("puts a rejected first saldo on an empty account back to empty", () => {
    rememberHomeSnapshot(homeSnap({ calculatedBalanceMinor: 10_000_00 }));
    rememberAccountsSnapshot({
      accounts: [
        {
          ...accountRow({ id: "empty", name: "Revolut" }),
          calculatedMinor: null,
          thbMinor: null,
        },
      ],
      totalThbMinor: null,
    });
    rememberMovementsSnapshot({ ...sampleMovements, balanceMinor: 10_000_00 });

    const before = captureOptimisticBalance();
    applyAccountBalance("empty", 5_412);

    expect(lastAccountsSnapshot()?.accounts[0]?.calculatedMinor).toBe(5_412);
    expect(lastHomeSnapshot()?.calculatedBalanceMinor).toBe(5_412);

    undoOptimisticBalance(before);

    expect(lastAccountsSnapshot()?.accounts[0]?.calculatedMinor).toBeNull();
    expect(lastAccountsSnapshot()?.totalThbMinor).toBeNull();
    expect(lastHomeSnapshot()?.calculatedBalanceMinor).toBe(10_000_00);
    expect(lastMovementsSnapshot()?.balanceMinor).toBe(10_000_00);
  });

  it("puts a rejected saldo back on the previous number", () => {
    rememberHomeSnapshot(homeSnap({ calculatedBalanceMinor: 100_00 }));
    rememberAccountsSnapshot({
      accounts: [accountRow({ calculatedMinor: 100_00 })],
      totalThbMinor: 100_00,
    });

    const before = captureOptimisticBalance();
    applyAccountBalance("a1", 999_00);
    undoOptimisticBalance(before);

    expect(lastAccountsSnapshot()?.accounts[0]?.calculatedMinor).toBe(100_00);
    expect(lastHomeSnapshot()?.calculatedBalanceMinor).toBe(100_00);
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
    expect(next?.overMinor).toBe(10_000_00 + 5_000_00 - 3_000_00 - 2_000_00);
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

  it("clears numa.lastHome.v1 immediately when another user binds", () => {
    let jar = "";
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        get cookie() {
          return jar;
        },
        set cookie(next: string) {
          const [pair] = next.split(";");
          const eq = pair.indexOf("=");
          const name = pair.slice(0, eq);
          const value = pair.slice(eq + 1);
          if (next.includes("Max-Age=0")) {
            jar = jar
              .split("; ")
              .filter((part) => part && !part.startsWith(`${name}=`))
              .join("; ");
            return;
          }
          const rest = jar
            .split("; ")
            .filter((part) => part && !part.startsWith(`${name}=`));
          rest.push(`${name}=${value}`);
          jar = rest.join("; ");
        },
      },
    });
    rememberHomeSnapshot(homeSnap({ remainingTodayMinor: 640_00 }));
    expect(document.cookie).toContain("numa.lastHome.v1=");
    bindSessionOwner("user-christian");
    expect(document.cookie).not.toContain("numa.lastHome.v1=");
    expect(lastHomeSnapshot()).toBeNull();
    bindSessionOwner("user-hugo");
    rememberHomeSnapshot(homeSnap({ remainingTodayMinor: 640_00 }));
    expect(document.cookie).toContain("numa.lastHome.v1=");
    bindSessionOwner("user-hugo");
    expect(document.cookie).toContain("numa.lastHome.v1=");
    expect(lastHomeSnapshot()?.remainingTodayMinor).toBe(640_00);
    clearClientSessionCaches();
    expect(document.cookie).not.toContain("numa.lastHome.v1=");
    Reflect.deleteProperty(globalThis, "document");
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
    expect(lastSessionHomeSnapshot()).toBeNull();

    invalidateHomeSessionPaint();
    expect(lastSessionHomeSnapshot()).toBeNull();

    rememberHomeSnapshot(
      homeSnap({ unpaidMinor: 0, overMinor: 108_287_00 }),
    );
    expect(lastSessionHomeSnapshot()?.unpaidMinor).toBe(0);
    expect(lastSessionHomeSnapshot()?.overMinor).toBe(108_287_00);
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("login invalidate keeps memory but blocks Hem paint until fetch", () => {
    rememberHomeSnapshot(
      homeSnap({ unpaidMinor: 120_00, overMinor: 108_167_00 }),
    );
    expect(isHomeSessionConfirmed()).toBe(true);
    invalidateHomeSessionPaint();
    expect(lastHomeSnapshot()?.unpaidMinor).toBe(120_00);
    expect(lastSessionHomeSnapshot()).toBeNull();
    expect(lastKnownHomeShell()?.unpaidMinor).toBe(120_00);
    rememberHomeSnapshot(
      homeSnap({ unpaidMinor: 0, overMinor: 108_287_00 }),
    );
    expect(lastSessionHomeSnapshot()?.overMinor).toBe(108_287_00);
  });

  it("keeps numa.lastHome.v1 on logout so the next same-user Hem can SSR", () => {
    let jar = "";
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        get cookie() {
          return jar;
        },
        set cookie(next: string) {
          const [pair] = next.split(";");
          const eq = pair.indexOf("=");
          const name = pair.slice(0, eq);
          const value = pair.slice(eq + 1);
          if (next.includes("Max-Age=0")) {
            jar = jar
              .split("; ")
              .filter((part) => part && !part.startsWith(`${name}=`))
              .join("; ");
            return;
          }
          const rest = jar
            .split("; ")
            .filter((part) => part && !part.startsWith(`${name}=`));
          rest.push(`${name}=${value}`);
          jar = rest.join("; ");
        },
      },
    });
    rememberHomeSnapshot(homeSnap({ remainingTodayMinor: 640_00 }));
    expect(document.cookie).toContain("numa.lastHome.v1=");
    clearClientSessionCaches({ keepHomeCookie: true });
    expect(lastHomeSnapshot()).toBeNull();
    expect(lastSessionHomeSnapshot()).toBeNull();
    expect(document.cookie).toContain("numa.lastHome.v1=");
    expect(document.cookie).toContain("64000");
    bindSessionOwner("user-hugo");
    expect(lastKnownHomeShell()?.remainingTodayMinor).toBe(640_00);
    expect(lastSessionHomeSnapshot()).toBeNull();
    Reflect.deleteProperty(globalThis, "document");
  });

  it("lastKnownHomeShell prefers SSR cookie then same-owner memory", () => {
    rememberHomeSnapshot(homeSnap({ remainingTodayMinor: 640_00 }));
    invalidateHomeSessionPaint();
    const ssr = homeSnap({ remainingTodayMinor: 111_00, userId: "user-hugo" });
    expect(lastKnownHomeShell(ssr)?.remainingTodayMinor).toBe(111_00);
    expect(lastKnownHomeShell()?.remainingTodayMinor).toBe(640_00);
    bindSessionOwner("user-christian");
    expect(lastKnownHomeShell()).toBeNull();
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
      homeSnap({
        userId: "user-test",
        remainingTodayMinor: 333_00,
        displayName: "Test",
      }),
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

  it("does not hydrate another user's cookie when persist belongs to someone else", () => {
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
      homeSnap({
        userId: "user-hugo",
        remainingTodayMinor: 333_00,
        displayName: "Hugo",
      }),
    );
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { cookie: `numa.lastHome.v1=${encoded}` },
    });
    hydrateLastKnownFromPersist();
    expect(lastHomeSnapshot()).toBeNull();
    Reflect.deleteProperty(globalThis, "localStorage");
    Reflect.deleteProperty(globalThis, "document");
  });

  it("does not let a leftover 275,12 fetch undo a 15k→20k living adopt", () => {
    const adopted = homeSnap({
      remainingTodayMinor: 0,
      dayBudgetMinor: 0,
      safeToSpendTodayMinor: 0,
      livingPoolMinor: 0,
      planMonthSavingsMinor: 20_000_00,
      savingsTotalMinor: 20_000_00,
      overMinor: 54_981_00,
      financeRevision: "rev-20k",
      verifiedAt: "2026-09-19T08:02:00.000Z",
    });
    const stale = homeSnap({
      remainingTodayMinor: 275_12,
      dayBudgetMinor: 275_12,
      safeToSpendTodayMinor: 275_12,
      livingPoolMinor: 1_650_75,
      planMonthSavingsMinor: 15_000_00,
      savingsTotalMinor: 15_000_00,
      overMinor: 59_981_00,
      financeRevision: "rev-cookie",
      verifiedAt: "2026-09-19T08:03:00.000Z",
    });
    expect(isLeftoverSparLivingRevert(adopted, stale)).toBe(true);
    rememberHomeSnapshot(adopted);
    rememberHomeSnapshot(stale);
    expect(lastHomeSnapshot()?.remainingTodayMinor).toBe(0);
    expect(lastHomeSnapshot()?.dayBudgetMinor).toBe(0);
    rememberHomeSnapshot(stale, { force: true });
    expect(lastHomeSnapshot()?.remainingTodayMinor).toBe(275_12);
  });

  it("force-adopts leftover 275,12 after restore and blocks stale 1 108,45", () => {
    rememberHomeSnapshot(
      homeSnap({
        remainingTodayMinor: 0,
        dayBudgetMinor: 0,
        safeToSpendTodayMinor: 0,
        livingPoolMinor: 0,
        planMonthSavingsMinor: 20_000_00,
        savingsTotalMinor: 20_000_00,
        financeRevision: "rev-20k",
        verifiedAt: "2026-09-19T08:02:00.000Z",
      }),
    );
    const restored = homeSnap({
      remainingTodayMinor: 275_12,
      dayBudgetMinor: 275_12,
      safeToSpendTodayMinor: 275_12,
      livingPoolMinor: 1_650_75,
      planMonthSavingsMinor: 15_000_00,
      savingsTotalMinor: 15_000_00,
      financeRevision: "rev-15k-restore",
      verifiedAt: "2026-09-19T08:04:00.000Z",
    });
    rememberHomeSnapshot(restored, { force: true });
    expect(lastSessionHomeSnapshot()?.dayBudgetMinor).toBe(275_12);

    const staleCashPool = homeSnap({
      remainingTodayMinor: 1_108_45,
      dayBudgetMinor: 1_108_45,
      safeToSpendTodayMinor: 1_108_45,
      livingPoolMinor: 6_650_75,
      planMonthSavingsMinor: 15_000_00,
      savingsTotalMinor: 15_000_00,
      financeRevision: "rev-cookie",
      verifiedAt: "2026-09-19T08:05:00.000Z",
    });
    expect(isLeftoverSparLivingRevert(restored, staleCashPool)).toBe(true);
    rememberHomeSnapshot(staleCashPool);
    expect(lastSessionHomeSnapshot()?.dayBudgetMinor).toBe(275_12);
    expect(lastSessionHomeSnapshot()?.remainingTodayMinor).toBe(275_12);

    // Same Bangkok day keep-shell: Plan sync can raise cycle spend and
    // recompute leftover as 1 650,75 / 5 days = 330,15. Same avsätt must not win.
    const staleFiveDay = homeSnap({
      remainingTodayMinor: 330_15,
      dayBudgetMinor: 330_15,
      safeToSpendTodayMinor: 330_15,
      livingPoolMinor: 1_650_75,
      planMonthSavingsMinor: 15_000_00,
      savingsTotalMinor: 15_000_00,
      cycleSpendingMinor: (restored.cycleSpendingMinor ?? 0) + 105_00,
      financeRevision: "rev-plan-local",
      verifiedAt: "2026-09-19T20:50:00.000Z",
    });
    expect(isLeftoverSparLivingRevert(restored, staleFiveDay)).toBe(true);
    rememberHomeSnapshot(staleFiveDay);
    expect(lastSessionHomeSnapshot()?.dayBudgetMinor).toBe(275_12);
    expect(lastSessionHomeSnapshot()?.remainingTodayMinor).toBe(275_12);
  });

  it("force-adopt of server 5-day leftover 330,15 overlays post-write 275,12", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-19T10:00:00.000Z"));
    rememberHomeSnapshot(
      homeSnap({
        remainingTodayMinor: 275_12,
        dayBudgetMinor: 275_12,
        safeToSpendTodayMinor: 275_12,
        livingPoolMinor: 1_650_75,
        remainingFreeMinor: 1_650_75,
        spendDaysLeft: 6,
        planMonthSavingsMinor: 15_000_00,
        savingsTotalMinor: 15_000_00,
        financeRevision: "rev-15k",
        verifiedAt: "2026-09-19T08:00:00.000Z",
      }),
    );
    rememberHomeSnapshot(
      homeSnap({
        remainingTodayMinor: 0,
        dayBudgetMinor: 0,
        safeToSpendTodayMinor: 0,
        livingPoolMinor: 0,
        remainingFreeMinor: -3_349_25,
        spendDaysLeft: 6,
        planMonthSavingsMinor: 20_000_00,
        savingsTotalMinor: 20_000_00,
        financeRevision: "rev-20k",
        verifiedAt: "2026-09-19T08:02:00.000Z",
      }),
      { force: true },
    );
    expect(lastSessionHomeSnapshot()?.dayBudgetMinor).toBe(0);

    rememberHomeSnapshot(
      homeSnap({
        remainingTodayMinor: 330_15,
        dayBudgetMinor: 330_15,
        safeToSpendTodayMinor: 330_15,
        livingPoolMinor: 1_650_75,
        remainingFreeMinor: 1_650_75,
        spendDaysLeft: 5,
        planMonthSavingsMinor: 15_000_00,
        savingsTotalMinor: 15_000_00,
        financeRevision: "rev-15k-restore",
        verifiedAt: "2026-09-19T20:30:00.000Z",
      }),
      { force: true },
    );
    expect(lastSessionHomeSnapshot()?.dayBudgetMinor).toBe(275_12);
    expect(lastSessionHomeSnapshot()?.remainingTodayMinor).toBe(275_12);
    expect(lastSessionHomeSnapshot()?.spendDaysLeft).toBe(6);
    expect(lastSessionHomeSnapshot()?.planMonthSavingsMinor).toBe(15_000_00);
  });

  it("cross-day leftover 6→5 adopts 330,15 — baseline does not freeze", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-19T10:00:00.000Z"));

    rememberHomeSnapshot(
      homeSnap({
        remainingTodayMinor: 275_12,
        dayBudgetMinor: 275_12,
        safeToSpendTodayMinor: 275_12,
        livingPoolMinor: 1_650_75,
        remainingFreeMinor: 1_650_75,
        spendDaysLeft: 6,
        daysUntilIncome: 6,
        planMonthSavingsMinor: 15_000_00,
        savingsTotalMinor: 15_000_00,
        financeRevision: "rev-15k",
        verifiedAt: "2026-09-19T10:00:00.000Z",
      }),
    );
    expect(lastSessionHomeSnapshot()?.dayBudgetMinor).toBe(275_12);
    expect(lastSessionHomeSnapshot()?.spendDaysLeft).toBe(6);

    vi.setSystemTime(new Date("2026-09-20T10:00:00.000Z"));

    const rolled = homeSnap({
      remainingTodayMinor: 330_15,
      dayBudgetMinor: 330_15,
      safeToSpendTodayMinor: 330_15,
      livingPoolMinor: 1_650_75,
      remainingFreeMinor: 1_650_75,
      spendDaysLeft: 5,
      daysUntilIncome: 5,
      planMonthSavingsMinor: 15_000_00,
      savingsTotalMinor: 15_000_00,
      financeRevision: "rev-15k-nextday",
      verifiedAt: "2026-09-20T10:00:00.000Z",
    });
    expect(isLeftoverSparLivingRevert(lastHomeSnapshot()!, rolled)).toBe(false);
    rememberHomeSnapshot(rolled);
    expect(lastSessionHomeSnapshot()?.dayBudgetMinor).toBe(330_15);
    expect(lastSessionHomeSnapshot()?.remainingTodayMinor).toBe(330_15);
    expect(lastSessionHomeSnapshot()?.spendDaysLeft).toBe(5);
    expect(lastHomeSnapshot()?.dayBudgetMinor).toBe(
      lastSessionHomeSnapshot()?.dayBudgetMinor,
    );

    rememberHomeSnapshot(rolled, { force: true });
    expect(lastSessionHomeSnapshot()?.dayBudgetMinor).toBe(330_15);
    expect(lastHomeSnapshot()?.dayBudgetMinor).toBe(330_15);
    expect(lastHomeSnapshot()?.remainingTodayMinor).toBe(330_15);
  });

  it("does not treat additive Plan warmup spend as a leftover savings revert", () => {
    const thbOnly = homeSnap({
      cycleSpendingMinor: 38_712_00,
      remainingTodayMinor: 1_200_00,
      dayBudgetMinor: 1_200_00,
      planMonthSavingsMinor: 0,
      savingsTotalMinor: 0,
    });
    const withSek = homeSnap({
      cycleSpendingMinor: 38_712_00 + 105_00,
      remainingTodayMinor: 2_000_00,
      dayBudgetMinor: 2_000_00,
      planMonthSavingsMinor: 0,
      savingsTotalMinor: 0,
    });
    expect(isLeftoverSparLivingRevert(thbOnly, withSek)).toBe(false);
    rememberHomeSnapshot(thbOnly);
    rememberHomeSnapshot(withSek);
    expect(lastHomeSnapshot()?.cycleSpendingMinor).toBe(38_712_00 + 105_00);
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

  it("adopts a newer server plan over a :local snapshot when the client clock is ahead", () => {
    // rememberHomeSnapshot stamps dirty writes with the client clock (L571).
    // Plan publish does the same and stores revision `:local`. Clean adopt
    // (rememberPlanSnapshot passes dirty=false) must not refuse the server
    // just because that client clock is ahead of the server verifiedAt.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T12:00:00.000Z"));
    const unpaid: PlanItem = {
      id: "audit-hyra",
      userId: "user-hugo",
      name: "Audit hyra 12345",
      kind: "mandatory",
      amountMinor: 12_345_00,
      currency: "THB",
      cadence: "monthly",
      nextDueAt: "2026-09-04T12:00:00.000Z",
      isActive: true,
      settledAt: null,
      settledMinor: null,
      remainingDueAt: null,
      createdAt: "2026-09-04T11:00:43.763Z",
      updatedAt: "2026-09-04T11:00:43.763Z",
    };
    const localPlan: PlanSnapshot = {
      items: [unpaid],
      currency: "THB",
      timeZone: "Asia/Bangkok",
      bankBalanceMinor: 116_588_00,
      spendingByMonthKey: {},
      ledgerTransactions: [],
      financeRevision: "rev-unpaid:local",
      verifiedAt: new Date().toISOString(),
      truthStatus: "stale",
    };
    rememberPlanSnapshot(localPlan);
    expect(lastPlanSnapshot()?.financeRevision).toBe("rev-unpaid:local");
    expect(lastPlanSnapshot()?.verifiedAt).toBe("2026-09-25T12:00:00.000Z");

    const serverPlan: PlanSnapshot = {
      ...localPlan,
      items: [
        {
          ...unpaid,
          settledAt: "2026-09-25T08:08:33.952Z",
          settledMinor: 12_345_00,
          updatedAt: "2026-09-25T08:08:33.952Z",
        },
      ],
      financeRevision: "rev-settled",
      verifiedAt: "2026-09-25T08:43:21.414Z",
      truthStatus: "verified",
    };
    rememberPlanSnapshot(serverPlan);

    expect(lastPlanSnapshot()?.financeRevision).toBe("rev-settled");
    expect(lastPlanSnapshot()?.items[0]?.settledAt).toBe(
      "2026-09-25T08:08:33.952Z",
    );
    expect(lastPlanSnapshot()?.items[0]?.settledMinor).toBe(12_345_00);
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

  it("drops a stale lastAccountsSnapshot when Hem På kontona moves", () => {
    rememberAccountsSnapshot({
      accounts: [accountRow({ id: "bb", calculatedMinor: 7_950_00 })],
      archivedAccounts: [],
      totalThbMinor: 7_950_00,
    });
    expect(lastAccountsSnapshot()?.totalThbMinor).toBe(7_950_00);
    rememberHomeSnapshot(homeSnap({ calculatedBalanceMinor: 3_421_95 }));
    expect(lastAccountsSnapshot()).toBeNull();
    expect(paintableAccountsSnapshot()).toBeNull();
  });

  it("keeps a Hem-aligned lastAccountsSnapshot so Konton first-tap can skip fetch", () => {
    const aligned = {
      accounts: [
        accountRow({ id: "bb", calculatedMinor: 3_231_95 }),
        accountRow({
          id: "tm",
          name: "TrueMoney",
          isDefault: false,
          calculatedMinor: 190_00,
        }),
      ],
      archivedAccounts: [] as [],
      totalThbMinor: 3_421_95,
    };
    rememberHomeSnapshot(homeSnap({ calculatedBalanceMinor: 3_421_95 }));
    rememberAccountsSnapshot(aligned);
    rememberHomeSnapshot(
      homeSnap({
        calculatedBalanceMinor: 3_421_95,
        financeRevision: "hem-same",
        verifiedAt: "2026-09-20T06:00:00.000Z",
      }),
    );
    expect(lastAccountsSnapshot()?.accounts.map((row) => row.id)).toEqual([
      "bb",
      "tm",
    ]);
    expect(paintableAccountsSnapshot()?.totalThbMinor).toBe(3_421_95);
  });

  it("replaces last-known missing TrueMoney when Plan accounts are richer and match Hem", () => {
    rememberHomeSnapshot(homeSnap({ calculatedBalanceMinor: 3_421_95 }));
    rememberAccountsSnapshot({
      accounts: [accountRow({ id: "bb", calculatedMinor: 3_421_95 })],
      archivedAccounts: [],
      totalThbMinor: 3_421_95,
    });
    rememberPlanSnapshot({
      items: [],
      currency: "THB",
      timeZone: "Asia/Bangkok",
      bankBalanceMinor: 3_421_95,
      spendingByMonthKey: {},
      ledgerTransactions: [],
      accounts: {
        accounts: [
          accountRow({ id: "bb", calculatedMinor: 3_231_95 }),
          accountRow({
            id: "tm",
            name: "TrueMoney",
            isDefault: false,
            calculatedMinor: 190_00,
          }),
        ],
        archivedAccounts: [],
        totalThbMinor: 3_421_95,
      },
      financeRevision: "plan-fresh",
      verifiedAt: "2026-09-20T06:00:00.000Z",
      truthStatus: "verified",
    });
    expect(lastAccountsSnapshot()?.accounts.map((row) => row.id)).toEqual([
      "bb",
      "tm",
    ]);
    expect(lastAccountsSnapshot()?.accounts.some((row) => row.name === "TrueMoney")).toBe(
      true,
    );
  });

  it("does not clobber a richer Konton last-known with a poorer Plan list", () => {
    rememberHomeSnapshot(homeSnap({ calculatedBalanceMinor: 3_421_95 }));
    rememberAccountsSnapshot({
      accounts: [
        accountRow({ id: "bb", calculatedMinor: 3_231_95 }),
        accountRow({
          id: "tm",
          name: "TrueMoney",
          isDefault: false,
          calculatedMinor: 190_00,
        }),
      ],
      archivedAccounts: [],
      totalThbMinor: 3_421_95,
    });
    rememberPlanSnapshot({
      items: [],
      currency: "THB",
      timeZone: "Asia/Bangkok",
      bankBalanceMinor: 3_421_95,
      spendingByMonthKey: {},
      ledgerTransactions: [],
      accounts: {
        accounts: [accountRow({ id: "bb", calculatedMinor: 3_421_95 })],
        archivedAccounts: [],
        totalThbMinor: 3_421_95,
      },
      financeRevision: "plan-poor",
      verifiedAt: "2026-09-20T06:00:00.000Z",
      truthStatus: "verified",
    });
    expect(lastAccountsSnapshot()?.accounts.map((row) => row.id)).toEqual([
      "bb",
      "tm",
    ]);
  });

  it("does not rehydrate a persisted lastAccountsSnapshot that disagrees with Hem", async () => {
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
    rememberHomeSnapshot(homeSnap({ calculatedBalanceMinor: 3_421_95 }));
    rememberAccountsSnapshot({
      accounts: [accountRow({ id: "bb", calculatedMinor: 3_421_95 })],
      archivedAccounts: [],
      totalThbMinor: 3_421_95,
    });
    await Promise.resolve();
    const raw = map.get("numa.lastKnown.v1");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as {
      accounts: { totalThbMinor: number };
      home: { calculatedBalanceMinor: number };
    };
    parsed.accounts.totalThbMinor = 7_950_00;
    const mutated = JSON.stringify(parsed);
    clearClientSessionCaches();
    map.set("numa.lastKnown.v1", mutated);
    hydrateLastKnownFromPersist();
    expect(lastHomeSnapshot()?.calculatedBalanceMinor).toBe(3_421_95);
    expect(lastAccountsSnapshot()).toBeNull();
    expect(paintableAccountsSnapshot()).toBeNull();
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("keeps Analys last-known when Spec S invalidates stale Konton", () => {
    rememberHomeSnapshot(homeSnap({ calculatedBalanceMinor: 3_421_95 }));
    expect(analysViewCanPaint(lastAnalysSnapshot())).toBe(true);
    const analys = lastAnalysSnapshot();
    rememberAccountsSnapshot({
      accounts: [accountRow({ id: "bb", calculatedMinor: 7_950_00 })],
      archivedAccounts: [],
      totalThbMinor: 7_950_00,
    });
    rememberHomeSnapshot(
      homeSnap({
        calculatedBalanceMinor: 3_421_95,
        financeRevision: "hem-after-konton",
        verifiedAt: "2026-09-20T07:00:00.000Z",
      }),
    );
    expect(lastAccountsSnapshot()).toBeNull();
    expect(paintableAccountsSnapshot()).toBeNull();
    expect(analysViewCanPaint(lastAnalysSnapshot())).toBe(true);
    expect(lastAnalysSnapshot()?.cycle.remainingFreeMinor).toBe(
      analys?.cycle.remainingFreeMinor,
    );
  });

  it("does not treat quiet-warm Konton adopt as a live session remember", () => {
    rememberHomeSnapshot(homeSnap({ calculatedBalanceMinor: 3_421_95 }));
    adoptAccountsLastKnown({
      accounts: [
        accountRow({ id: "bb", calculatedMinor: 3_231_95 }),
        accountRow({
          id: "tm",
          name: "TrueMoney",
          isDefault: false,
          calculatedMinor: 190_00,
        }),
      ],
      archivedAccounts: [],
      totalThbMinor: 3_421_95,
    });
    expect(paintableAccountsSnapshot()?.totalThbMinor).toBe(3_421_95);
    rememberHomeSnapshot(
      homeSnap({
        calculatedBalanceMinor: 5_000_00,
        financeRevision: "hem-moved",
        verifiedAt: "2026-09-20T08:00:00.000Z",
      }),
    );
    expect(paintableAccountsSnapshot()).toBeNull();
    expect(analysViewCanPaint(lastAnalysSnapshot())).toBe(true);
  });

  it("gapFill falls through to Hem when remember no-ops an unpaintable Analys", () => {
    rememberHomeSnapshot(homeSnap({ calculatedBalanceMinor: 3_421_95 }));
    expect(analysViewCanPaint(lastAnalysSnapshot())).toBe(true);
    rememberPlanSnapshot({
      items: [],
      currency: "THB",
      timeZone: "Asia/Bangkok",
      bankBalanceMinor: 3_421_95,
      spendingByMonthKey: {},
      ledgerTransactions: [],
      financeRevision: "older-plan",
      verifiedAt: "2026-08-01T00:00:00.000Z",
      truthStatus: "verified",
    });
    rememberAnalysSnapshot({
      ...lastAnalysSnapshot()!,
      month: null as never,
      currentMonthKey: "",
      financeRevision: "newer-than-plan",
      verifiedAt: "2026-09-21T00:00:00.000Z",
    });
    expect(analysViewCanPaint(lastAnalysSnapshot())).toBe(false);

    rememberHomeSnapshot(
      homeSnap({
        calculatedBalanceMinor: 3_421_95,
        financeRevision: "older-echo",
        verifiedAt: "2026-08-01T00:00:00.000Z",
      }),
    );

    expect(analysViewCanPaint(lastAnalysSnapshot())).toBe(true);
    expect(lastAnalysSnapshot()?.cycle.remainingFreeMinor).toBe(
      homeSnap().remainingFreeMinor,
    );
  });

  it("Konton adopt still invalidates stale accounts after Analys first-bars", () => {
    rememberHomeSnapshot(homeSnap({ calculatedBalanceMinor: 3_421_95 }));
    rememberPlanSnapshot({
      items: [],
      currency: "THB",
      timeZone: "Asia/Bangkok",
      bankBalanceMinor: 3_421_95,
      spendingByMonthKey: { "2026-09": 175_00 },
      ledgerTransactions: [
        {
          id: "tx-bar",
          accountId: "acc",
          amountMinor: 175_00,
          currency: "THB",
          transactionType: "expense",
          direction: "debit",
          status: "confirmed",
          occurredAt: "2026-09-18T04:00:00.000Z",
          description: "Lunch",
        },
      ] as PlanSnapshot["ledgerTransactions"],
      financeRevision: "rev-1",
      verifiedAt: "2026-09-19T05:00:00.000Z",
      truthStatus: "verified",
    });
    upgradeAnalysFromPlanNow();
    expect(analysViewCanPaint(lastAnalysSnapshot())).toBe(true);
    expect(analysSnapshotHasDatapaint(lastAnalysSnapshot())).toBe(true);
    const analys = lastAnalysSnapshot();
    adoptAccountsLastKnown({
      accounts: [accountRow({ id: "bb", calculatedMinor: 7_950_00 })],
      archivedAccounts: [],
      totalThbMinor: 7_950_00,
    });
    expect(lastAccountsSnapshot()).toBeNull();
    expect(paintableAccountsSnapshot()).toBeNull();
    expect(analysViewCanPaint(lastAnalysSnapshot())).toBe(true);
    expect(analysSnapshotHasDatapaint(lastAnalysSnapshot())).toBe(true);
    expect(lastAnalysSnapshot()).toBe(analys);
  });

  it("Konton adopt invalidates stale accounts without clearing Analys paint", () => {
    rememberHomeSnapshot(homeSnap({ calculatedBalanceMinor: 3_421_95 }));
    expect(analysViewCanPaint(lastAnalysSnapshot())).toBe(true);
    const analys = lastAnalysSnapshot();
    adoptAccountsLastKnown({
      accounts: [accountRow({ id: "bb", calculatedMinor: 7_950_00 })],
      archivedAccounts: [],
      totalThbMinor: 7_950_00,
    });
    expect(lastAccountsSnapshot()).toBeNull();
    expect(paintableAccountsSnapshot()).toBeNull();
    expect(analysViewCanPaint(lastAnalysSnapshot())).toBe(true);
    expect(lastAnalysSnapshot()).toBe(analys);
  });
});
