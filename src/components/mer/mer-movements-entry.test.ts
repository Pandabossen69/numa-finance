/** @vitest-environment jsdom */

import { createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UNCATEGORISED_SPEND_NAME } from "@/domain/finance";
import { movementsViewForCategoryDrill } from "@/components/analys/analys-category-drill";
import { NavIntentProvider } from "@/components/layout/NavIntent";
import { MerScreen } from "@/components/mer/MerScreen";
import { MovementsScreen } from "@/components/movements/MovementsScreen";
import type { MovementRow, MovementsSnapshot } from "@/features/finance/load-movements";
import {
  clearClientSessionCaches,
  lastMovementsView,
  rememberMovementsSnapshot,
  rememberMovementsView,
} from "@/features/home/last-snapshot";

vi.mock("next/navigation", () => ({
  usePathname: () => "/mer",
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
    ...rest
  }: {
    href?: string;
    children?: ReactNode;
    onClick?: (event: { preventDefault(): void }) => void;
  }) =>
    createElement(
      "a",
      {
        href,
        ...rest,
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
  partial: Pick<MovementRow, "id" | "occurredAt" | "transactionType" | "category"> &
    Partial<MovementRow>,
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

const snapshot: MovementsSnapshot = {
  currency: "THB",
  hasBankTruth: false,
  balanceMinor: null,
  monthIncomeMinor: 0,
  monthExpenseMinor: 100_00,
  monthNetMinor: -100_00,
  allIncomeMinor: 500_00,
  allExpenseMinor: 200_00,
  allNetMinor: 300_00,
  monthCategories: [],
  timeZone: "Asia/Bangkok",
  monthKey: "2026-09",
  items: [
    row({
      id: "mat",
      occurredAt: "2026-09-10T04:00:00.000Z",
      transactionType: "expense",
      category: "Mat",
    }),
    row({
      id: "lon",
      occurredAt: "2026-08-01T04:00:00.000Z",
      transactionType: "income",
      category: "Lön",
    }),
    row({
      id: "hyra",
      occurredAt: "2026-11-02T04:00:00.000Z",
      transactionType: "expense",
      category: "Hyra",
    }),
  ],
};

function listHeading(root: ParentNode): string {
  const heading = [...root.querySelectorAll("h2")].find((el) =>
    /rörelse/.test(el.textContent ?? ""),
  );
  return (heading?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function chip(root: ParentNode, label: string): HTMLButtonElement {
  const found = [...root.querySelectorAll("button")].find((button) =>
    (button.textContent ?? "").includes(label),
  );
  if (!(found instanceof HTMLButtonElement)) {
    throw new Error(`missing chip ${label}`);
  }
  return found;
}

function chipOn(button: HTMLButtonElement): boolean {
  return (
    button.getAttribute("aria-pressed") === "true" ||
    button.className.includes("bg-[var(--numa-ink)]")
  );
}

function tap(el: Element, init: PointerEventInit = {}) {
  act(() => {
    el.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        button: 0,
        ...init,
      }),
    );
    el.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
        ...init,
      }),
    );
  });
}

describe("Mer → Rörelser menu entry", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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
    rememberMovementsSnapshot(snapshot);
    rememberMovementsView({
      filter: "expense",
      period: "cycle",
      category: "Mat",
      cycleStartAt: CYCLE_START,
      cycleEndAt: CYCLE_END,
    });
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
              data: {
                userId: "user-test",
                displayName: "Test",
                isAdmin: false,
              },
            }),
            createElement(MovementsScreen, { data: snapshot }),
          ),
        ),
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    clearClientSessionCaches();
  });

  it("opens the full list from Mer and still accepts a Perioden drill", () => {
    expect(listHeading(host)).toBe("1 rörelse · Mat");
    expect(chipOn(chip(host, "Perioden"))).toBe(true);
    expect(chipOn(chip(host, "Utgifter"))).toBe(true);

    const konton = host.querySelector('a[href="/konton"]');
    const rorelser = host.querySelector("[data-mer-movements]");
    expect(konton).toBeInstanceOf(HTMLAnchorElement);
    expect(rorelser).toBeInstanceOf(HTMLAnchorElement);
    expect(host.querySelectorAll("[data-mer-movements]")).toHaveLength(1);

    tap(konton as Element);
    expect(lastMovementsView()?.category).toBe("Mat");
    expect(listHeading(host)).toBe("1 rörelse · Mat");

    tap(rorelser as Element, { metaKey: true });
    expect(lastMovementsView()?.period).toBe("cycle");
    expect(listHeading(host)).toBe("1 rörelse · Mat");

    tap(rorelser as Element);
    expect(lastMovementsView()).toEqual({
      filter: "all",
      period: "all",
      category: null,
      cycleStartAt: CYCLE_START,
      cycleEndAt: CYCLE_END,
    });
    expect(listHeading(host)).toBe("3 rörelser");
    expect(chipOn(chip(host, "All tid"))).toBe(true);
    expect(chipOn(chip(host, "Alla"))).toBe(true);
    expect(chipOn(chip(host, "Perioden"))).toBe(false);
    expect(chipOn(chip(host, "Utgifter"))).toBe(false);

    act(() => {
      rememberMovementsView(
        movementsViewForCategoryDrill(UNCATEGORISED_SPEND_NAME, {
          scope: "period",
          activeMonthKey: "2026-09",
          currentMonthKey: "2026-09",
          existing: lastMovementsView(),
          cycleStartAt: CYCLE_START,
          cycleEndAt: CYCLE_END,
        }),
      );
    });
    expect(lastMovementsView()).toEqual({
      filter: "expense",
      period: "cycle",
      category: UNCATEGORISED_SPEND_NAME,
      cycleStartAt: CYCLE_START,
      cycleEndAt: CYCLE_END,
    });
    expect(chipOn(chip(host, "Perioden"))).toBe(true);
    expect(chipOn(chip(host, "Utgifter"))).toBe(true);
    expect(listHeading(host)).toBe(`0 rörelser · ${UNCATEGORISED_SPEND_NAME}`);
  });
});
