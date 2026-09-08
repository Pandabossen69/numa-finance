import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HomeSnapshot } from "@/features/finance/load-home";
import {
  AnalysPending,
  AnalysViewLoading,
  HemPending,
  HomeViewLoading,
  PlanPending,
} from "./ViewLoading";

const home = {
  remainingTodayMinor: 800_00,
  remainingFreeMinor: 11_000_00,
  currency: "THB",
} as HomeSnapshot;

describe("first-paint pending", () => {
  it("paints last-known kvar idag instead of empty mint cards", () => {
    const analysMoney = renderToStaticMarkup(
      createElement(AnalysPending, { home }),
    );
    const analysEmpty = renderToStaticMarkup(createElement(AnalysPending));
    const hem = renderToStaticMarkup(createElement(HemPending));
    const plan = renderToStaticMarkup(createElement(PlanPending));
    const oldHem = renderToStaticMarkup(createElement(HomeViewLoading));
    const oldAnalys = renderToStaticMarkup(createElement(AnalysViewLoading));

    expect(analysMoney).toContain("Kvar idag");
    expect(analysMoney).toMatch(/800/);
    expect(analysMoney).toMatch(/11[\s\u00a0]?000/);
    expect(analysMoney).toContain("Hämtar analysen");
    expect(analysMoney).not.toContain("h-[10.5rem]");
    expect(analysEmpty).toContain("Hämtar analysen");
    expect(analysEmpty).not.toContain("h-[10.5rem]");
    expect(hem).toContain("Hämtar läget");
    expect(hem).not.toContain("h-[22rem]");
    expect(plan).toContain("Hämtar planen");
    expect(plan).not.toContain("h-[22rem]");
    expect(oldHem).toContain("h-[22rem]");
    expect(oldAnalys).toContain("h-[10.5rem]");
  });
});
