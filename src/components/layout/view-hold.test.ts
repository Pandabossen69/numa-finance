import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { ViewLoading } from "./ViewLoading";
import { isViewLoadingNode } from "./view-hold";

describe("isViewLoadingNode", () => {
  it("recognizes ViewLoading and the data marker", () => {
    expect(isViewLoadingNode(createElement(ViewLoading))).toBe(true);
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

