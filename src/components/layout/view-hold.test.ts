import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { AnalysViewLoading, ViewLoading } from "./ViewLoading";
import { isViewLoadingNode, shouldHoldPreviousView } from "./view-hold";

describe("isViewLoadingNode", () => {
  it("recognizes ViewLoading and the data marker", () => {
    expect(isViewLoadingNode(createElement(ViewLoading))).toBe(true);
    expect(isViewLoadingNode(createElement(AnalysViewLoading))).toBe(true);
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

