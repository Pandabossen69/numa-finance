import { createElement, Fragment, Suspense } from "react";
import { describe, expect, it } from "vitest";
import { AnalysViewLoading, HomeViewLoading, ViewLoading } from "./ViewLoading";
import {
  isViewLoadingNode,
  resolveVisibleTab,
  shouldHoldPreviousView,
} from "./view-hold";

describe("isViewLoadingNode", () => {
  it("recognizes dedicated loading shells, not real pages", () => {
    expect(isViewLoadingNode(createElement(ViewLoading))).toBe(true);
    expect(isViewLoadingNode(createElement(AnalysViewLoading))).toBe(true);
    expect(isViewLoadingNode(createElement(HomeViewLoading))).toBe(true);
    expect(
      isViewLoadingNode(
        createElement("div", { "data-numa-view-loading": true }, "x"),
      ),
    ).toBe(true);
    expect(
      isViewLoadingNode(createElement(Fragment, null, createElement(ViewLoading))),
    ).toBe(true);
    expect(isViewLoadingNode(createElement("div", null, "Plan"))).toBe(false);
  });

  it("does not treat Suspense, nested skeletons, or Laddar labels as the whole page", () => {
    expect(isViewLoadingNode(createElement(Suspense, null, "Mer"))).toBe(false);
    expect(
      isViewLoadingNode(createElement("div", { "aria-label": "Laddar Mer" })),
    ).toBe(false);
    expect(
      isViewLoadingNode(createElement("div", { className: "numa-skel h-8" })),
    ).toBe(false);
    expect(
      isViewLoadingNode(
        createElement("div", null, createElement(ViewLoading)),
      ),
    ).toBe(false);
  });
});

describe("shouldHoldPreviousView", () => {
  it("does not hold Hem while Analys streams", () => {
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

  it("shows dest on a first visit instead of keeping Hem on screen", () => {
    expect(
      resolveVisibleTab({
        loading: true,
        leaving: false,
        destTab: "/fota",
        heldTab: "/plan",
        destIsTabRoot: true,
        hasDestCache: false,
      }),
    ).toBe("dest");
  });

  it("shows dest while leaving Hem even before the Plan payload arrives", () => {
    expect(
      resolveVisibleTab({
        loading: false,
        leaving: true,
        destTab: "/plan",
        heldTab: "/idag",
        destIsTabRoot: true,
        hasDestCache: false,
      }),
    ).toBe("dest");
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
});
