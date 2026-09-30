/** @vitest-environment jsdom */

import { createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NavIntentProvider } from "@/components/layout/NavIntent";
import { MerScreen } from "@/components/mer/MerScreen";
import { MovementsScreen } from "@/components/movements/MovementsScreen";
import {
  lastMovementsDrill,
  rememberMovementsDrillFromHref,
  resetMovementsDrillForTests,
} from "@/components/movements/movements-drill";
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
  monthCategories: [{ name: "Mat", amountMinor: 100_00, count: 1 }],
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

const SAVED = {
  filter: "expense" as const,
  period: "month" as const,
  category: null,
};

function listHeading(root: ParentNode): string {
  const heading = [...root.querySelectorAll("h2")].find((el) =>
    /rörelse/.test(el.textContent ?? ""),
  );
  return (heading?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function chip(root: ParentNode, label: string): HTMLButtonElement {
  const found = [...root.querySelectorAll("button")].find(
    (button) => (button.textContent ?? "").trim() === label,
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
    resetMovementsDrillForTests();
    window.history.replaceState(null, "", "/mer");
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
    rememberMovementsView(SAVED);
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
    window.history.replaceState(null, "", "/");
    clearClientSessionCaches();
    resetMovementsDrillForTests();
  });

  it("overlays a drill on the parked panel and Mer without params restores the saved chips", () => {
    expect(listHeading(host)).toBe("1 rörelse");
    expect(chipOn(chip(host, "Denna månad"))).toBe(true);
    expect(chipOn(chip(host, "Utgifter"))).toBe(true);

    act(() => {
      rememberMovementsDrillFromHref(
        "/transaktioner?drill=1&period=month&filter=expense&cat=Mat",
      );
    });
    expect(lastMovementsDrill()?.category).toBe("Mat");
    expect(lastMovementsView()).toMatchObject(SAVED);
    expect(listHeading(host)).toBe("1 rörelse · Mat");

    const rorelser = [...host.querySelectorAll('a[href="/transaktioner"]')].find(
      (el) => (el.textContent ?? "").includes("Rörelser"),
    );
    expect(rorelser).toBeInstanceOf(HTMLAnchorElement);
    expect(host.querySelector("[data-mer-movements]")).toBeNull();

    tap(rorelser as Element, { metaKey: true });
    expect(lastMovementsDrill()?.category).toBe("Mat");

    tap(rorelser as Element);
    expect(lastMovementsDrill()).toBeNull();
    expect(lastMovementsView()).toMatchObject(SAVED);
    expect(chipOn(chip(host, "Denna månad"))).toBe(true);
    expect(chipOn(chip(host, "Utgifter"))).toBe(true);
    expect(listHeading(host)).toBe("1 rörelse");
  });
});
