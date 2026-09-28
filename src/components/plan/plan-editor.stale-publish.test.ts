/** @vitest-environment jsdom */

import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlanEditor } from "@/components/plan/PlanEditor";
import { PlanScreen } from "@/components/plan/PlanScreen";
import type { PlanItem } from "@/domain/finance";
import type { PlanSnapshot } from "@/features/finance/load-plan";
import {
  clearClientSessionCaches,
  lastPlanSnapshot,
  rememberPlanSnapshot,
} from "@/features/home/last-snapshot";

vi.mock("next/navigation", () => ({
  usePathname: () => "/plan",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    prefetch: () => {},
    push: () => {},
    replace: () => {},
    refresh: () => {},
  }),
}));

vi.mock("@/features/plan/actions", () => ({
  createPlanExtraAction: vi.fn(async () => ({ ok: true })),
  createPlanIncomeAction: vi.fn(async () => ({ ok: true })),
  createPlanItemAction: vi.fn(async () => ({ ok: true })),
  deletePlanItemAction: vi.fn(async () => ({ ok: true })),
  importFixedExpensesFromPreviousMonthAction: vi.fn(async () => ({ ok: true })),
  setMonthSavingsAction: vi.fn(async () => ({ ok: true })),
  confirmPlanLinkAction: vi.fn(async () => ({ ok: true })),
  setPlanItemSettledAction: vi.fn(async () => ({ ok: true })),
  updatePlanItemAction: vi.fn(async () => ({ ok: true })),
}));

function item(id: string, name: string, kind: PlanItem["kind"] = "mandatory"): PlanItem {
  return {
    id,
    userId: "user-hugo",
    name,
    kind,
    amountMinor: 10_000_00,
    currency: "THB",
    cadence: "monthly",
    nextDueAt: "2026-09-28T12:00:00.000Z",
    isActive: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function snapshot(items: PlanItem[], revision: string): PlanSnapshot {
  return {
    items,
    currency: "THB",
    timeZone: "Asia/Bangkok",
    bankBalanceMinor: 10_000_00,
    spendingByMonthKey: { "2026-09": 100 },
    ledgerTransactions: [],
    financeRevision: revision,
    verifiedAt: "2026-09-20T00:00:00.000Z",
    truthStatus: "verified",
  };
}

describe("PlanEditor does not publish a hidden copy's old rows", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    clearClientSessionCaches();
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
  });

  it("keeps a 3-row server plan when two stale editors mount", async () => {
    const fresh = snapshot(
      [item("1", "Lön", "expected"), item("2", "Hyra"), item("3", "Mat")],
      "rev-3",
    );
    rememberPlanSnapshot(fresh);
    const stale = fresh.items.slice(0, 2);

    function editors(spend: number) {
      const shared = {
        items: stale,
        currency: "THB" as const,
        timeZone: "Asia/Bangkok",
        bankBalanceMinor: fresh.bankBalanceMinor,
        spendingByMonthKey: { "2026-09": spend },
      };
      return createElement(
        "div",
        null,
        createElement(PlanEditor, shared),
        createElement(PlanEditor, {
          ...shared,
          spendingByMonthKey: { "2026-09": spend + 1 },
        }),
      );
    }

    await act(async () => {
      root.render(editors(100));
    });
    await act(async () => {
      root.render(editors(500));
    });

    const stored = lastPlanSnapshot();
    expect(stored?.items.map((row) => row.name)).toEqual(["Lön", "Hyra", "Mat"]);
    expect(stored?.items).toHaveLength(3);
    expect(stored?.financeRevision.endsWith(":local")).toBe(false);
    expect(stored?.financeRevision).toBe("rev-3");
  });

  it("still publishes after Sätt av", async () => {
    const fresh = snapshot(
      [item("1", "Lön", "expected"), item("2", "Hyra"), item("3", "Mat")],
      "rev-3",
    );
    rememberPlanSnapshot(fresh);

    await act(async () => {
      root.render(
        createElement(PlanEditor, {
          items: fresh.items,
          currency: "THB",
          timeZone: "Asia/Bangkok",
          bankBalanceMinor: fresh.bankBalanceMinor,
          spendingByMonthKey: fresh.spendingByMonthKey,
        }),
      );
    });

    const input = host.querySelector(
      'input[aria-label^="Sätt av"]',
    ) as HTMLInputElement | null;
    expect(input).toBeTruthy();
    await act(async () => {
      const proto = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      );
      proto?.set?.call(input, "2000");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const button = [...host.querySelectorAll("button")].find((el) =>
      el.textContent?.includes("Sätt av från Över"),
    );
    expect(button).toBeTruthy();
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const stored = lastPlanSnapshot();
    expect(stored?.financeRevision).toBe("rev-3:local");
    expect(stored?.items.map((row) => row.name)).toEqual(
      expect.arrayContaining(["Lön", "Hyra", "Mat"]),
    );
  });

  it("does not republish when PlanScreen already holds that revision", async () => {
    const fresh = snapshot(
      [item("1", "Lön", "expected"), item("2", "Hyra"), item("3", "Mat")],
      "rev-3",
    );
    rememberPlanSnapshot(fresh);
    const current = lastPlanSnapshot();
    expect(current).toBeTruthy();
    const echoA: PlanSnapshot = {
      ...current!,
      items: current!.items.map((row) => ({ ...row })),
    };
    const echoB: PlanSnapshot = {
      ...current!,
      items: current!.items.map((row) => ({ ...row })),
    };
    expect(echoA).not.toBe(current);
    expect(echoB).not.toBe(current);

    await act(async () => {
      root.render(
        createElement(
          "div",
          null,
          createElement(PlanScreen, { initial: echoA }),
          createElement(PlanScreen, { initial: echoB }),
        ),
      );
    });

    expect(lastPlanSnapshot()).toBe(current);
    expect(lastPlanSnapshot()?.items).toHaveLength(3);
    expect(lastPlanSnapshot()?.financeRevision).toBe("rev-3");
    expect(lastPlanSnapshot()?.items.map((row) => row.name)).toContain("Mat");
  });
});
