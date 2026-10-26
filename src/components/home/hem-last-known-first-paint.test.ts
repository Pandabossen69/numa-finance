/** @vitest-environment jsdom */

import { createElement, useLayoutEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HemRouteClient } from "@/components/home/HemRouteClient";
import type { HomeSnapshot } from "@/features/finance/load-home";
import type { PlanSnapshot } from "@/features/finance/load-plan";
import { LAST_KNOWN_STORAGE_KEY } from "@/features/home/last-snapshot-persist";
import {
  clearClientSessionCaches,
  hydrateLastKnownFromPersist,
} from "@/features/home/last-snapshot";
import type { PlanItem } from "@/domain/finance";

vi.mock("next/navigation", () => ({
  usePathname: () => "/idag",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    prefetch: () => {},
    push: () => {},
    replace: () => {},
    refresh: () => {},
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href?: string;
    children?: ReactNode;
  }) => createElement("a", { href }, children),
}));

vi.mock("@/lib/numa/read-client", () => ({
  readHomeSnapshot: () => new Promise(() => {}),
  readMovementsSnapshot: () => new Promise(() => {}),
  readMerSnapshot: () => new Promise(() => {}),
  readAnalysSnapshot: () => new Promise(() => {}),
  readQuietMenuBundle: () => new Promise(() => {}),
  readImporteraRows: () => new Promise(() => {}),
  readPlanPageData: () => new Promise(() => {}),
  readAccountsSnapshot: () => new Promise(() => {}),
  readPendingBankMailCount: () => new Promise(() => {}),
}));

vi.mock("@/features/finance/actions", () => ({
  createExpenseAction: () => Promise.resolve({ ok: false, error: "test" }),
  setAvailableNowAction: () => Promise.resolve({ ok: false, error: "test" }),
}));

vi.mock("@/lib/nav/quiet-menu-warm", () => ({
  scheduleQuietMenuWarm: () => {},
  resetQuietMenuWarmForTests: () => {},
  waitForQuietMenuWarm: () => Promise.resolve(),
  quietMenuCacheReady: () => false,
}));

function income(id: string, nextDueAt: string): PlanItem {
  return {
    id,
    userId: "user-hugo",
    name: id,
    kind: "expected",
    amountMinor: 40_000_00,
    currency: "THB",
    cadence: "income",
    nextDueAt,
    isActive: true,
    settledAt: null,
    settledMinor: null,
    remainingDueAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

function home(partial: Partial<HomeSnapshot>): HomeSnapshot {
  return {
    userId: "user-hugo",
    displayName: "Hugo",
    timeZone: "Asia/Bangkok",
    primaryAccountId: "acc",
    currency: "THB",
    monthKey: "2026-10",
    monthLabelSv: "oktober",
    hasBankTruth: true,
    calculatedBalanceMinor: 14_593_300,
    verificationLabel: null,
    todaySpendingMinor: 0,
    todayPlannedPaidMinor: 0,
    monthSpendingMinor: 0,
    cycleSpendingMinor: 0,
    safeToSpendTodayMinor: 14_593_300,
    cycleStartLabelSv: "25 sep.",
    cycleEndLabelSv: "25 okt.",
    cycleEndInferred: false,
    cycleIsActive: false,
    livingMode: "bridge",
    needsAvailableInput: false,
    usesBankBalance: true,
    planIncomeMinor: 40_000_00,
    planExpenseMinor: 0,
    planSavingsMinor: 0,
    freeToSpendMinor: 40_000_00,
    remainingFreeMinor: 14_593_300,
    spendDaysLeft: 0,
    dayBudgetMinor: 14_593_300,
    remainingTodayMinor: 14_593_300,
    livingPoolMinor: 14_593_300,
    reservedUntilIncomeMinor: 0,
    daysUntilIncome: 0,
    nextIncomeLabelSv: "25 okt.",
    dayEnvelopeOpen: true,
    extraSaldoMinor: 0,
    extraSaldoDrawnMinor: 0,
    extraSaldoHint: null,
    extraCarriedInMinor: 0,
    savingsTotalMinor: 0,
    wealthTotalMinor: 14_593_300,
    monthResultMinor: 0,
    incomingMinor: 0,
    unpaidMinor: 0,
    overMinor: 14_593_300,
    financeRevision: "cache",
    verifiedAt: "2026-10-25T03:00:00.000Z",
    truthStatus: "verified",
    ...partial,
  };
}

function plan(
  items: PlanItem[],
  verifiedAt: string,
  bankBalanceMinor = 14_593_300,
): PlanSnapshot {
  return {
    items,
    currency: "THB",
    timeZone: "Asia/Bangkok",
    bankBalanceMinor,
    spendingByMonthKey: {},
    ledgerTransactions: [],
    financeRevision: "cache",
    verifiedAt,
    truthStatus: "verified",
  };
}

function seed(homeSnap: HomeSnapshot, planSnap: PlanSnapshot | null) {
  const payload = {
    v: 1,
    userId: "user-hugo",
    home: homeSnap,
    plan: planSnap,
    analys: null,
    mer: null,
    accounts: null,
    movements: null,
    gettingStarted: null,
    planView: null,
    analysScope: null,
    movementsView: null,
  };
  window.localStorage.setItem(LAST_KNOWN_STORAGE_KEY, JSON.stringify(payload));
}

function Boot() {
  useLayoutEffect(() => {
    hydrateLastKnownFromPersist();
  }, []);
  return createElement(HemRouteClient);
}

function Harness() {
  return createElement(Boot);
}

function flat(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

describe("Hem first render from numa.lastKnown.v1", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers({ toFake: ["Date"] });
    clearClientSessionCaches();
    if (typeof window.matchMedia !== "function") {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: () => ({
          matches: false,
          media: "",
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }),
      });
    }
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    clearClientSessionCaches();
    vi.useRealTimers();
  });

  it("paints Perioden är slut on the first frames when yesterday was the horizon", () => {
    vi.setSystemTime(new Date("2026-10-26T03:00:00.000Z"));
    seed(
      home({}),
      plan(
        [
          income("sep", "2026-09-25T12:00:00.000Z"),
          income("okt", "2026-10-25T12:00:00.000Z"),
        ],
        "2026-10-25T03:00:00.000Z",
      ),
    );
    const painted: string[] = [];
    const observer = new MutationObserver(() => {
      painted.push(flat(host.textContent));
    });
    observer.observe(host, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    act(() => {
      root.render(createElement(Harness));
    });
    observer.disconnect();
    painted.push(flat(host.textContent));
    const shown = painted.filter((frame) => frame.length > 0);
    expect(shown.length).toBeGreaterThan(0);
    for (const frame of shown) {
      expect(frame).not.toContain("Kvar idag");
      expect(frame).not.toMatch(/Kvar\s+145/);
    }
    const last = shown[shown.length - 1] ?? "";
    expect(last).toContain("Perioden är slut");
    expect(last.replace(/\s/g, "")).toContain("145933");
  });

  it("does not flash yesterday's Kvar or Perioden är slut when the horizon is still ahead", () => {
    vi.setSystemTime(new Date("2026-10-20T03:00:00.000Z"));
    seed(
      home({
        verifiedAt: "2026-10-19T03:00:00.000Z",
        spendDaysLeft: 6,
        daysUntilIncome: 6,
        dayBudgetMinor: 2_432_216,
        remainingTodayMinor: 2_432_216,
        safeToSpendTodayMinor: 2_432_216,
        calculatedBalanceMinor: 10_000_00,
        livingPoolMinor: 10_000_00,
        overMinor: 10_000_00,
        wealthTotalMinor: 10_000_00,
        monthKey: "2026-09",
        nextIncomeLabelSv: "25 sep.",
      }),
      plan(
        [
          income("sep", "2026-09-25T12:00:00.000Z"),
          income("okt", "2026-10-25T12:00:00.000Z"),
        ],
        "2026-10-19T03:00:00.000Z",
        10_000_00,
      ),
    );
    const painted: string[] = [];
    const observer = new MutationObserver(() => {
      painted.push(flat(host.textContent));
    });
    observer.observe(host, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    act(() => {
      root.render(createElement(Harness));
    });
    observer.disconnect();
    painted.push(flat(host.textContent));
    const shown = painted.filter((frame) => frame.length > 0);
    expect(shown.length).toBeGreaterThan(0);
    for (const frame of shown) {
      expect(frame).not.toContain("Perioden är slut");
      expect(frame).not.toContain("24 322,16");
    }
    const last = shown[shown.length - 1] ?? "";
    const skeleton = host.querySelector(".numa-skel");
    const hasNewBudget = /Kvar idag/.test(last) && !last.includes("24 322,16");
    expect(skeleton != null || hasNewBudget).toBe(true);
    if (!skeleton) {
      expect(last).toContain("Kvar idag");
      expect(last).not.toContain("24 322,16");
    }
  });
});
