import { createElement, Suspense } from "react";
import { describe, expect, it } from "vitest";
import { MovementsViewLoading } from "@/components/movements/MovementsViewLoading";
import {
  AnalysPending,
  AnalysViewLoading,
  HemPending,
  HomeViewLoading,
  ViewLoading,
} from "./ViewLoading";
import {
  isViewLoadingNode,
  resolveVisibleTab,
  shouldHoldPreviousView,
} from "./view-hold";

describe("isViewLoadingNode", () => {
  it("recognizes ViewLoading, Suspense, and the data marker", () => {
    expect(isViewLoadingNode(createElement(ViewLoading))).toBe(true);
    expect(isViewLoadingNode(createElement(AnalysViewLoading))).toBe(true);
    expect(isViewLoadingNode(createElement(AnalysPending))).toBe(true);
    expect(isViewLoadingNode(createElement(HomeViewLoading))).toBe(true);
    expect(isViewLoadingNode(createElement(HemPending))).toBe(true);
    expect(
      isViewLoadingNode(
        createElement("div", { "data-numa-view-loading": "true" }, "x"),
      ),
    ).toBe(true);
    expect(isViewLoadingNode(createElement(MovementsViewLoading))).toBe(true);
    expect(isViewLoadingNode(createElement(Suspense, null, "x"))).toBe(true);
    expect(
      isViewLoadingNode(
        createElement("div", { "data-numa-view-loading": true }, "x"),
      ),
    ).toBe(true);
    expect(
      isViewLoadingNode(createElement("div", { "aria-label": "Laddar Mer" })),
    ).toBe(true);
    expect(
      isViewLoadingNode(createElement("div", { className: "numa-skel h-8" })),
    ).toBe(true);
    expect(isViewLoadingNode(createElement("div", null, "Plan"))).toBe(false);
    expect(
      isViewLoadingNode(
        createElement("div", null, createElement(ViewLoading)),
      ),
    ).toBe(true);
  });
});

describe("shouldHoldPreviousView", () => {
  it("does not hold Hem while Analys streams — dest shell must paint immediately", () => {
    expect(
      shouldHoldPreviousView({
        loading: true,
        leaving: false,
        destTab: "/analys",
        heldTab: "/idag",
      }),
    ).toBe(false);
  });

  it("does not hold once the destination is ready", () => {
    expect(
      shouldHoldPreviousView({
        loading: false,
        leaving: false,
        destTab: "/analys",
        heldTab: "/idag",
      }),
    ).toBe(false);
  });

  it("does not hold Mer → Saldo drill-in", () => {
    expect(
      shouldHoldPreviousView({
        loading: true,
        leaving: false,
        destTab: "/mer",
        heldTab: "/mer",
      }),
    ).toBe(false);
  });
});

describe("resolveVisibleTab", () => {
  it("shows dest cache on tab revisit so the dashboard is not remounted", () => {
    expect(
      resolveVisibleTab({
        loading: true,
        leaving: false,
        destTab: "/idag",
        heldTab: "/analys",
        destIsTabRoot: true,
        hasDestCache: true,
      }),
    ).toBe("dest");
  });

  it("shows dest loading on a first visit instead of the previous tab", () => {
    expect(
      resolveVisibleTab({
        loading: true,
        leaving: false,
        destTab: "/fota",
        heldTab: "/plan",
        destIsTabRoot: true,
        hasDestCache: false,
      }),
    ).toBe("dest-loading");
  });

  it("does not hold Mer drill-in even when dest cache exists", () => {
    expect(
      resolveVisibleTab({
        loading: true,
        leaving: false,
        destTab: "/mer",
        heldTab: "/mer",
        destIsTabRoot: false,
        hasDestCache: true,
      }),
    ).toBe("children");
  });

  it("keeps Plan mounted on same-tab refresh instead of flashing loading.tsx", () => {
    expect(
      resolveVisibleTab({
        loading: true,
        leaving: false,
        destTab: "/plan",
        heldTab: "/plan",
        destIsTabRoot: true,
        hasDestCache: true,
      }),
    ).toBe("dest");
  });

  it("paints dest shell when URL already matches dest but loading.tsx is the outlet", () => {
    expect(
      resolveVisibleTab({
        loading: true,
        leaving: false,
        destTab: "/transaktioner",
        heldTab: "/analys",
        destIsTabRoot: true,
        hasDestCache: false,
        pathTab: "/transaktioner",
        outletStale: false,
      }),
    ).toBe("dest-loading");
    expect(
      resolveVisibleTab({
        loading: true,
        leaving: false,
        destTab: "/transaktioner",
        heldTab: "/analys",
        destIsTabRoot: true,
        hasDestCache: true,
        pathTab: "/transaktioner",
        outletStale: false,
      }),
    ).toBe("dest");
  });

  it("paints dest shell when the URL already moved but children are still the previous page", () => {
    expect(
      resolveVisibleTab({
        loading: false,
        leaving: false,
        destTab: "/analys",
        heldTab: "/idag",
        destIsTabRoot: true,
        hasDestCache: false,
        pathTab: "/analys",
        outletStale: true,
      }),
    ).toBe("dest-loading");
    expect(
      resolveVisibleTab({
        loading: false,
        leaving: false,
        destTab: "/plan",
        heldTab: "/idag",
        destIsTabRoot: true,
        hasDestCache: true,
        pathTab: "/plan",
        outletStale: true,
      }),
    ).toBe("dest");
  });
});
