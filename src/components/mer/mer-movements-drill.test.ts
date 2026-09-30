/** @vitest-environment jsdom */

import { createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalysDashboard } from "@/components/analys/AnalysDashboard";
import { NavIntentProvider } from "@/components/layout/NavIntent";
import { MerScreen } from "@/components/mer/MerScreen";
import { MovementsScreen } from "@/components/movements/MovementsScreen";
import type { AnalysSnapshot } from "@/features/finance/load-analys";
import type { MovementRow, MovementsSnapshot } from "@/features/finance/load-movements";
import {
  clearClientSessionCaches,
  lastAnalysScope,
  lastMovementsView,
  rememberAnalysScope,
  rememberMovementsSnapshot,
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
    onPointerDown?: (event: PointerEvent) => void;
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
  monthCategories: [],
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

describe("Analys drill vs Mer → Rörelser", () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    clearClientSessionCaches();
  });

  function mount(scope: "period" | "month") {
    clearClientSessionCaches();
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

  it("keeps Perioden and Månad drills off the Mer row, then clears only a drill", () => {
    mount("period");
    const category = host.querySelector("[data-analys-category='Mat']");
    expect(category).toBeInstanceOf(HTMLAnchorElement);
    tap(category as Element);
    expect(lastMovementsView()).toEqual({
      filter: "expense",
      period: "cycle",
      category: "Mat",
      cycleStartAt: CYCLE_START,
      cycleEndAt: CYCLE_END,
      source: "drill",
    });

    const alla = [...host.querySelectorAll('a[href="/transaktioner"]')].find(
      (el) => (el.textContent ?? "").includes("Alla"),
    );
    expect(alla).toBeInstanceOf(HTMLAnchorElement);
    expect(alla?.hasAttribute("data-mer-movements")).toBe(false);
    tap(alla as Element);
    expect(lastMovementsView()?.source).toBe("drill");
    expect(lastMovementsView()?.period).toBe("cycle");

    const rorelser = host.querySelector('[data-mer-movements="rorelser"]');
    expect(rorelser).toBeInstanceOf(HTMLAnchorElement);
    expect(host.querySelectorAll("[data-mer-movements]")).toHaveLength(1);
    tap(rorelser as Element);
    expect(lastMovementsView()).toEqual({
      filter: "all",
      period: "all",
      category: null,
      cycleStartAt: CYCLE_START,
      cycleEndAt: CYCLE_END,
      source: "menu",
    });

    const monthTab = host.querySelector('[role="tablist"][aria-label="Analysvy"]');
    expect(monthTab).toBeInstanceOf(HTMLElement);
    tap(buttonNamed(monthTab as HTMLElement, "Månad"));
    const monthCategory = host.querySelector("[data-analys-category='Mat']");
    expect(monthCategory).toBeInstanceOf(HTMLAnchorElement);
    tap(monthCategory as Element);
    expect(lastMovementsView()).toEqual({
      filter: "expense",
      period: "month",
      category: "Mat",
      source: "drill",
    });
    expect(lastAnalysScope()).toBe("month");
  });

  it("keeps a Utgifter chip the user chose when Mer → Rörelser is tapped", () => {
    mount("month");
    tap(buttonNamed(host, "Utgifter"));
    expect(lastMovementsView()).toMatchObject({
      filter: "expense",
      period: "month",
      category: null,
      source: "user",
    });
    tap(host.querySelector('[data-mer-movements="rorelser"]') as Element);
    expect(lastMovementsView()).toMatchObject({
      filter: "expense",
      period: "month",
      category: null,
      source: "user",
    });
  });
});
