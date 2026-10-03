/** @vitest-environment jsdom */

import { createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalysDashboard } from "@/components/analys/AnalysDashboard";
import { NavIntentProvider } from "@/components/layout/NavIntent";
import { MerScreen } from "@/components/mer/MerScreen";
import { MovementsScreen } from "@/components/movements/MovementsScreen";
import {
  lastMovementsDrill,
  resetMovementsDrillForTests,
} from "@/components/movements/movements-drill";
import type { AnalysSnapshot } from "@/features/finance/load-analys";
import type { MovementRow, MovementsSnapshot } from "@/features/finance/load-movements";
import {
  clearClientSessionCaches,
  lastAnalysScope,
  lastMovementsView,
  rememberAnalysScope,
  rememberMovementsSnapshot,
  rememberMovementsView,
} from "@/features/home/last-snapshot";

vi.mock("next/navigation", () => ({
  usePathname: () => "/analys",
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
    onClick,
    onPointerDown,
    ...rest
  }: {
    href?: string;
    children?: ReactNode;
    onClick?: (event: { preventDefault(): void }) => void;
    onPointerDown?: (event: { button: number }) => void;
  }) =>
    createElement(
      "a",
      {
        href,
        ...rest,
        onPointerDown,
        onClick: (event: { preventDefault(): void }) => {
          event.preventDefault();
          onClick?.(event);
        },
      },
      children,
    ),
}));

const CYCLE_START = "2026-09-03T00:00:00.000Z";
const CYCLE_END = "2026-10-25T00:00:00.000Z";

function row(
  partial: Pick<MovementRow, "id" | "occurredAt" | "transactionType" | "category">,
): MovementRow {
  return {
    description: partial.id,
    direction: partial.transactionType === "income" ? "credit" : "debit",
    amountMinor: 100_00,
    currency: "THB",
    nativeAmountMinor: 100_00,
    nativeCurrency: "THB",
    source: "manual",
    ...partial,
  };
}

const movements: MovementsSnapshot = {
  currency: "THB",
  hasBankTruth: false,
  balanceMinor: null,
  monthIncomeMinor: 0,
  monthExpenseMinor: 100_00,
  monthNetMinor: -100_00,
  allIncomeMinor: 30_000_00,
  allExpenseMinor: 100_00,
  allNetMinor: 0,
  monthCategories: [{ name: "Mat", amountMinor: 100_00, count: 1 }],
  timeZone: "Asia/Bangkok",
  monthKey: "2026-09",
  items: [
    row({
      id: "mat-sep",
      occurredAt: "2026-09-10T04:00:00.000Z",
      transactionType: "expense",
      category: "Mat",
    }),
    row({
      id: "income-old",
      occurredAt: "2026-08-01T04:00:00.000Z",
      transactionType: "income",
      category: "Mat",
    }),
  ],
};

const analys = {
  currency: "THB",
  hasBankTruth: false,
  monthKey: "2026-09",
  calculatedBalanceMinor: null,
  todaySpendingMinor: 0,
  monthSpendingMinor: 100_00,
  cycleSpendingMinor: 100_00,
  cycle: {
    startAt: CYCLE_START,
    endAt: CYCLE_END,
    startLabelSv: "3 sep.",
    endLabelSv: "25 okt.",
    isActive: true,
    livingMode: "cycle",
    incomeMinor: 0,
    expenseMinor: 100_00,
    savingsMinor: 0,
    freeToSpendMinor: 0,
    remainingFreeMinor: 0,
    daysLeft: 10,
    nextIncomeLabelSv: null,
    dayBudgetMinor: 0,
    remainingTodayMinor: 0,
    incomes: [],
    expenses: [],
  },
  month: {
    incomeMinor: 0,
    expenseMinor: 100_00,
    savingsMinor: 0,
    freeToSpendMinor: 0,
    extraSaldoMinor: 0,
    extraSaldoDrawnMinor: 0,
    extraSaldoHint: null,
    extraCarriedInMinor: 0,
    savingsTotalMinor: 0,
    monthLeftoverHint: null,
    monthResultMinor: 0,
    spentMinor: 100_00,
    incomes: [],
    expenses: [],
  },
  timeZone: "Asia/Bangkok",
  currentMonthKey: "2026-09",
  planItems: [],
  spendingByMonthKey: {},
  ledgerTransactions: [
    {
      id: "mat-sep",
      status: "confirmed",
      direction: "debit",
      transactionType: "expense",
      amountMinor: 100_00,
      occurredAt: "2026-09-10T04:00:00.000Z",
      description: "Mat",
      merchant: null,
      source: "manual",
      fingerprint: null,
      balanceAfterMinor: null,
      sourceObservationId: null,
      category: "Mat",
      currency: "THB",
    },
  ],
  categoriesByMonthKey: {
    "2026-09": [{ name: "Mat", amountMinor: 100_00, count: 1 }],
  },
  goals: [],
  formula: { steps: [] },
  financeRevision: "t",
  verifiedAt: "2026-09-30T00:00:00.000Z",
  truthStatus: "verified",
} as unknown as AnalysSnapshot;

const SAVED_ALL = {
  filter: "all" as const,
  period: "all" as const,
  category: null,
};

function tap(el: Element) {
  act(() => {
    el.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        button: 0,
      }),
    );
    el.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
      }),
    );
  });
}

function buttonNamed(root: ParentNode, label: string): HTMLButtonElement {
  const found = [...root.querySelectorAll("button")].find(
    (button) => (button.textContent ?? "").trim() === label,
  );
  if (!(found instanceof HTMLButtonElement)) {
    throw new Error(`missing button ${label}`);
  }
  return found;
}

function listHeading(root: ParentNode): string {
  const heading = [...root.querySelectorAll("h2")].find((el) =>
    /rörelse/.test(el.textContent ?? ""),
  );
  return (heading?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function chipOn(button: HTMLButtonElement): boolean {
  return (
    button.getAttribute("aria-pressed") === "true" ||
    button.className.includes("bg-[var(--numa-ink)]")
  );
}

describe("Analys drill vs Mer → Rörelser", () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    window.history.replaceState(null, "", "/");
    clearClientSessionCaches();
    resetMovementsDrillForTests();
  });

  function mount(scope: "period" | "month") {
    clearClientSessionCaches();
    resetMovementsDrillForTests();
    window.history.replaceState(null, "", "/analys");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: () => ({
        matches: false,
        media: "",
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
    rememberAnalysScope(scope);
    rememberMovementsSnapshot(movements);
    rememberMovementsView(SAVED_ALL);
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root.render(
        createElement(
          NavIntentProvider,
          null,
          createElement(
            "div",
            null,
            createElement(MerScreen, {
              data: { userId: "u", displayName: "Test", isAdmin: false },
            }),
            createElement(AnalysDashboard, { data: analys }),
            createElement(MovementsScreen, { data: movements }),
          ),
        ),
      );
    });
  }

  function rorelserLink(): HTMLAnchorElement {
    const found = [...host.querySelectorAll('a[href="/transaktioner"]')].find(
      (el) => (el.textContent ?? "").includes("Rörelser"),
    );
    if (!(found instanceof HTMLAnchorElement)) {
      throw new Error("missing Mer → Rörelser");
    }
    return found;
  }

  it("shows the month drill without writing the saved All tid view", () => {
    mount("month");
    const category = host.querySelector("[data-analys-category='Mat']");
    expect(category).toBeInstanceOf(HTMLAnchorElement);
    expect((category as HTMLAnchorElement).getAttribute("href")).toContain(
      "period=month",
    );
    expect((category as HTMLAnchorElement).getAttribute("href")).toContain(
      "filter=expense",
    );
    tap(category as Element);
    expect(lastMovementsDrill()).toMatchObject({
      period: "month",
      filter: "expense",
      category: "Mat",
    });
    expect(lastMovementsView()).toMatchObject(SAVED_ALL);
    expect(chipOn(buttonNamed(host, "Denna månad"))).toBe(true);
    expect(chipOn(buttonNamed(host, "Utgifter"))).toBe(true);
    expect(chipOn(buttonNamed(host, "All tid"))).toBe(false);
    expect(listHeading(host)).toBe("1 rörelse · Mat");
  });

  it("drops the drill on Mer → Rörelser and keeps a Utgifter chip the user chose", () => {
    mount("period");
    const category = host.querySelector("[data-analys-category='Mat']");
    expect(category).toBeInstanceOf(HTMLAnchorElement);
    expect((category as HTMLAnchorElement).getAttribute("href")).toContain(
      "period=cycle",
    );
    tap(category as Element);
    expect(chipOn(buttonNamed(host, "Perioden"))).toBe(true);
    expect(chipOn(buttonNamed(host, "Utgifter"))).toBe(true);
    expect(listHeading(host)).toBe("1 rörelse · Mat");
    expect(lastMovementsView()).toMatchObject(SAVED_ALL);

    tap(rorelserLink());
    expect(lastMovementsDrill()).toBeNull();
    expect(lastMovementsView()).toMatchObject(SAVED_ALL);
    expect(chipOn(buttonNamed(host, "All tid"))).toBe(true);
    expect(chipOn(buttonNamed(host, "Alla"))).toBe(true);
    expect(listHeading(host)).toBe("2 rörelser");

    tap(buttonNamed(host, "Utgifter"));
    expect(lastMovementsView()).toMatchObject({
      filter: "expense",
      period: "all",
      category: null,
    });
    tap(rorelserLink());
    expect(lastMovementsView()).toMatchObject({
      filter: "expense",
      period: "all",
      category: null,
    });
    expect(chipOn(buttonNamed(host, "Utgifter"))).toBe(true);
    expect(lastAnalysScope()).toBe("period");
  });
});
