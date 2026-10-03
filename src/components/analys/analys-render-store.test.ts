/** @vitest-environment jsdom */

import { createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysRouteClient } from "@/components/analys/AnalysRouteClient";
import { AnalysFirstPaint } from "@/components/layout/HemFirstPaint";
import { NavIntentProvider } from "@/components/layout/NavIntent";
import { resetAnalysClientFetchForTests } from "@/features/finance/analys-client-fetch";
import { resetAnalysPlanUpgradeForTests } from "@/features/finance/ensure-analys-last-known";
import type { HomeSnapshot } from "@/features/finance/load-home";
import {
  clearClientSessionCaches,
  invalidateAnalysSnapshot,
  rememberHomeSnapshot,
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
  }: {
    href?: string;
    children?: ReactNode;
  }) => createElement("a", { href }, children),
}));

vi.mock("@/lib/numa/read-client", () => ({
  readAnalysSnapshot: () => Promise.resolve({ ok: false, error: "test" }),
  readQuietMenuBundle: () => Promise.resolve({ ok: false, error: "test" }),
  readHomeSnapshot: () => Promise.resolve({ ok: false, error: "test" }),
}));

vi.mock("@/lib/nav/quiet-menu-warm", () => ({
  scheduleQuietMenuWarm: () => {},
  resetQuietMenuWarmForTests: () => {},
}));

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

function tree(tick: number) {
  return createElement(
    NavIntentProvider,
    null,
    createElement(
      "div",
      null,
      createElement(AnalysRouteClient),
      createElement(AnalysFirstPaint),
      createElement("span", { "data-tick": String(tick) }),
    ),
  );
}

describe("Analys and Hem first paint do not write the store during render", () => {
  let host: HTMLDivElement;
  let root: Root;
  let errors: string[];

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    clearClientSessionCaches();
    resetAnalysClientFetchForTests();
    resetAnalysPlanUpgradeForTests();
    errors = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map((part) => String(part)).join(" "));
    });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    host.remove();
    clearClientSessionCaches();
    resetAnalysClientFetchForTests();
    resetAnalysPlanUpgradeForTests();
    vi.restoreAllMocks();
  });

  it("paints Analys from Hem without a render-phase store warning", async () => {
    rememberHomeSnapshot(home);
    await act(async () => {
      root.render(tree(0));
    });

    expect(host.textContent).toContain("Analys");
    expect(host.textContent).not.toContain("Hämtar analysen");

    invalidateAnalysSnapshot();
    await act(async () => {
      root.render(tree(1));
    });

    expect(host.textContent).toContain("Analys");
    expect(host.textContent).not.toContain("Hämtar analysen");
    const renderWarning = errors.filter(
      (line) =>
        line.includes("Cannot update a component") &&
        line.includes("while rendering"),
    );
    expect(renderWarning).toEqual([]);
  });
});
