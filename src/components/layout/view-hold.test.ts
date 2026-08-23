import { createElement, Suspense } from "react";
import { describe, expect, it } from "vitest";
import { AnalysViewLoading, HomeViewLoading, ViewLoading } from "./ViewLoading";
import {
  isViewLoadingNode,
  resolveVisibleTab,
  shouldHoldPreviousView,
} from "./view-hold";

describe("isViewLoadingNode", () => {
  it("recognizes ViewLoading, Suspense, and the data marker", () => {
    expect(isViewLoadingNode(createElement(ViewLoading))).toBe(true);
    expect(isViewLoadingNode(createElement(AnalysViewLoading))).toBe(true);
    expect(isViewLoadingNode(createElement(HomeViewLoading))).toBe(true);
    expect(isViewLoadingNode(createElement(Suspense, null, "x"))).toBe(true);
    expect(
      isViewLoadingNode(
        createElement("div", { "data-numa-view-loading": true }, "x"),
      ),
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
  it("holds Hem while Analys streams", () => {
    expect(
      shouldHoldPreviousView({
        loading: true,
        leaving: false,
        destTab: "/analys",
        heldTab: "/idag",
      }),
    ).toBe(true);
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

  it("holds the previous tab on a first visit", () => {
    expect(
      resolveVisibleTab({
        loading: true,
        leaving: false,
        destTab: "/fota",
        heldTab: "/plan",
        destIsTabRoot: true,
        hasDestCache: false,
      }),
    ).toBe("held");
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
});
