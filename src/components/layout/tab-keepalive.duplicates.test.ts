/** @vitest-environment jsdom */

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, useEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HemRouteClient } from "@/components/home/HemRouteClient";
import { LastViewOutlet } from "@/components/layout/LastViewOutlet";
import { NavIntentProvider, useNavIntent } from "@/components/layout/NavIntent";
import { TabKeepAlive } from "@/components/layout/TabKeepAlive";
import type { PlanItem } from "@/domain/finance";
import type { HomeSnapshot } from "@/features/finance/load-home";
import type { PlanSnapshot } from "@/features/finance/load-plan";
import {
  clearClientSessionCaches,
  rememberHomeSnapshot,
  rememberPlanSnapshot,
} from "@/features/home/last-snapshot";
import { resetAnalysClientFetchForTests } from "@/features/finance/analys-client-fetch";
import { resetAnalysPlanUpgradeForTests } from "@/features/finance/ensure-analys-last-known";
import { goHomeInstant } from "@/lib/nav/instant";
import { resetQuietMenuWarmForTests } from "@/lib/nav/quiet-menu-warm";

const nav = vi.hoisted(() => ({ pathname: "/idag" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
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

vi.mock("@/features/finance/home-snapshot", () => ({
  getHomeSnapshotAction: () => Promise.resolve({ ok: false, error: "test" }),
}));

vi.mock("@/features/finance/movements-snapshot", () => ({
  getMovementsSnapshotAction: () => Promise.resolve({ ok: false, error: "test" }),
}));

vi.mock("@/features/finance/mer-snapshot", () => ({
  getMerSnapshotAction: () => Promise.resolve({ ok: false, error: "test" }),
}));

vi.mock("@/features/finance/analys-snapshot", () => ({
  getAnalysSnapshotAction: () => Promise.resolve({ ok: false, error: "test" }),
}));

vi.mock("@/features/finance/quiet-menu-bundle", () => ({
  getQuietMenuBundleAction: () => Promise.resolve({ ok: false, error: "test" }),
}));

vi.mock("@/features/imports/capture-resume-action", () => ({
  getCaptureResumeAction: () => Promise.resolve(null),
}));

vi.mock("@/components/plan/load-plan", () => ({
  getPlanPageDataAction: () => Promise.resolve({ ok: false, error: "test" }),
}));

vi.mock("@/lib/nav/quiet-menu-warm", () => ({
  scheduleQuietMenuWarm: () => {},
  resetQuietMenuWarmForTests: () => {},
  waitForQuietMenuWarm: () => Promise.resolve(),
  quietMenuCacheReady: () => false,
}));

vi.mock("@/lib/route-islands", async () => {
  const { createElement: h } = await import("react");
  const { PlanEditor } = await import("@/components/plan/PlanEditor");
  const stub = (name: string) =>
    function IslandStub() {
      return h("div", { "data-island": name });
    };
  return {
    PlanEditor,
    HomeDashboard: stub("home"),
    PlanScreen: stub("plan-screen"),
    AnalysDashboard: stub("analys"),
    ReceiptCaptureFlow: () =>
      h(
        "form",
        { "aria-label": "Manuellt" },
        h("h2", null, "Manuellt"),
        h("button", { type: "button" }, "Spara utgift"),
      ),
    MovementsScreen: stub("movements"),
    OnboardingSaldoChoice: stub("saldo"),
    OnboardingManualSaldo: stub("manual"),
  };
});

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

const planItem = {
  id: "hyra",
  userId: "user-hugo",
  name: "Hyra",
  kind: "mandatory",
  amountMinor: 10_000_00,
  currency: "THB",
  cadence: "monthly",
  nextDueAt: "2026-09-28T12:00:00.000Z",
  isActive: true,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
} as PlanItem;

const plan = {
  items: [planItem],
  currency: "THB",
  timeZone: "Asia/Bangkok",
  bankBalanceMinor: 10_000_00,
  spendingByMonthKey: { "2026-09": 100 },
  ledgerTransactions: [],
  financeRevision: "rev-plan",
  verifiedAt: "2026-09-20T00:00:00.000Z",
  truthStatus: "verified",
} as PlanSnapshot;

function NavProbe({
  navigateRef,
}: {
  navigateRef: { current: ((href: string) => boolean) | null };
}) {
  const { navigateSpaTab } = useNavIntent();
  useEffect(() => {
    navigateRef.current = navigateSpaTab;
  }, [navigateRef, navigateSpaTab]);
  return null;
}

function shell(
  child: ReactNode,
  navigateRef: { current: ((href: string) => boolean) | null },
) {
  return createElement(
    NavIntentProvider,
    null,
    createElement(NavProbe, { navigateRef }),
    createElement(TabKeepAlive, null, createElement(LastViewOutlet, null, child)),
  );
}

describe("tab keep-alive does not grow hidden route copies", () => {
  let host: HTMLDivElement;
  let root: Root;
  const navigateRef: { current: ((href: string) => boolean) | null } = {
    current: null,
  };
  const depthErrors: string[] = [];

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    nav.pathname = "/idag";
    clearClientSessionCaches();
    resetQuietMenuWarmForTests();
    resetAnalysClientFetchForTests();
    resetAnalysPlanUpgradeForTests();
    rememberHomeSnapshot(home);
    rememberPlanSnapshot(plan);
    if (typeof window.matchMedia !== "function") {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: (query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }),
      });
    }
    if (typeof Element.prototype.scrollIntoView !== "function") {
      Element.prototype.scrollIntoView = () => {};
    }
    if (typeof window.scrollTo !== "function") {
      window.scrollTo = () => {};
    }
    depthErrors.length = 0;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host, {
      onUncaughtError: (error) => {
        depthErrors.push(error instanceof Error ? error.message : String(error));
      },
      onCaughtError: (error) => {
        depthErrors.push(error instanceof Error ? error.message : String(error));
      },
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    host.remove();
    clearClientSessionCaches();
    resetQuietMenuWarmForTests();
    resetAnalysClientFetchForTests();
    resetAnalysPlanUpgradeForTests();
    vi.restoreAllMocks();
  });

  it("keeps HomeDashboard and PlanEditor counts flat across 10 tab switches", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    await act(async () => {
      root.render(shell(createElement(HemRouteClient), navigateRef));
    });

    const visible = (tab: string) =>
      host.querySelector(
        `[data-numa-spa-tab="${tab}"][data-numa-spa-visible="1"]`,
      );
    const homeCount = () => host.querySelectorAll("#spend-heading").length;
    const planCount = () => host.querySelectorAll("[data-plan-month-key]").length;
    const shadowContent = () =>
      host.querySelectorAll("[data-numa-rsc-shadow] *").length;

    expect(visible("/idag")).toBeTruthy();
    expect(homeCount()).toBeGreaterThan(0);
    expect(homeCount()).toBeLessThanOrEqual(2);
    expect(planCount()).toBeLessThanOrEqual(2);

    const homeAtStart = homeCount();
    const planAtStart = planCount();
    const shadowAtStart = shadowContent();

    const steps = [
      "/transaktioner",
      "/fota",
      "/plan",
      "/idag",
      "/transaktioner",
      "/fota",
      "/plan",
      "/idag",
      "/transaktioner",
      "/fota",
    ];

    let typed = "";
    for (let index = 0; index < steps.length; index += 1) {
      const href = steps[index]!;
      await act(async () => {
        expect(navigateRef.current?.(href)).toBe(true);
      });
      expect(visible(href)).toBeTruthy();
      expect(depthErrors.join("\n")).not.toContain("Maximum update depth");

      if (href === "/plan" && typed === "") {
        const planPanel = visible("/plan");
        const input = planPanel?.querySelector('input[aria-label^="Sätt av"]');
        expect(input).toBeTruthy();
        await act(async () => {
          const proto = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value",
          );
          proto?.set?.call(input, "1 500");
          input?.dispatchEvent(new Event("input", { bubbles: true }));
        });
        typed = (input as HTMLInputElement).value;
        expect(typed).toBe("1 500");
      }

      if (href === "/plan" && index > 2) {
        const input = visible("/plan")?.querySelector("input");
        expect((input as HTMLInputElement | null)?.value).toBe(typed);
      }
    }

    expect(homeCount()).toBe(homeAtStart);
    expect(planCount()).toBe(planAtStart);
    expect(shadowContent()).toBe(shadowAtStart);

    const parkedNodes = () =>
      host.querySelectorAll("[data-numa-spa-tab] *").length;
    const round = [
      "/idag",
      "/plan",
      "/analys",
      "/transaktioner",
      "/mer",
    ];
    await act(async () => {
      expect(navigateRef.current?.("/idag")).toBe(true);
    });
    const nodesAtRoundOne = parkedNodes();
    for (let pass = 0; pass < 10; pass += 1) {
      for (const href of round) {
        await act(async () => {
          expect(navigateRef.current?.(href)).toBe(true);
        });
      }
    }
    expect(parkedNodes()).toBe(nodesAtRoundOne);
    expect(scrollTo).toHaveBeenCalled();
    expect(depthErrors.join("\n")).not.toContain("Maximum update depth");

    nav.pathname = "/konton";
    await act(async () => {
      root.render(
        shell(
          createElement("div", { "data-subroute": "konton" }, "Konton"),
          navigateRef,
        ),
      );
    });
    const sub = host.querySelector("[data-subroute]");
    expect(sub).toBeTruthy();
    expect(sub?.textContent).toBe("Konton");
    expect(sub?.closest("[hidden]")).toBeNull();
    expect(host.querySelector("[data-numa-spa-tab]")).toBeNull();
  });

  it("paints Hem and hides the Fota form after a save, not only the URL", async () => {
    await act(async () => {
      root.render(shell(createElement(HemRouteClient), navigateRef));
    });

    const visibleText = () =>
      [...host.querySelectorAll<HTMLElement>("[data-numa-spa-tab]")]
        .filter((panel) => !panel.hidden)
        .map((panel) => panel.textContent ?? "")
        .join("\n");

    await act(async () => {
      expect(navigateRef.current?.("/fota")).toBe(true);
    });
    expect(visibleText()).toContain("Spara utgift");
    expect(visibleText()).not.toContain("Kvar idag");

    // App Router can move the URL to /idag while spaPath still owns Fota.
    nav.pathname = "/idag";
    await act(async () => {
      root.render(shell(createElement(HemRouteClient), navigateRef));
    });
    expect(visibleText()).toContain("Spara utgift");
    expect(visibleText()).not.toContain("Kvar idag");

    const push = vi.fn();
    await act(async () => {
      goHomeInstant({
        push,
        replace: () => {},
        refresh: () => {},
        back: () => {},
        forward: () => {},
        prefetch: () => {},
      } as unknown as AppRouterInstance);
    });

    expect(visibleText()).toContain("Kvar idag");
    expect(visibleText()).not.toContain("Spara utgift");
    expect(visibleText()).not.toContain("Manuellt");
    const form = host.querySelector("form[aria-label='Manuellt']");
    expect(form?.textContent).toContain("Spara utgift");
    expect(form?.closest("[hidden]")).not.toBeNull();
    expect(push).not.toHaveBeenCalled();
  });
});
