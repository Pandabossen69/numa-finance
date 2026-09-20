import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AnalysPending,
  AnalysViewLoading,
  HemPending,
  HomeViewLoading,
  ViewLoading,
} from "./ViewLoading";

const analysSrc = readFileSync(new URL("./ViewLoading.tsx", import.meta.url), "utf8");

describe("first-paint pending", () => {
  it("paints a short Analys purpose pending, never Hem kvar idag", () => {
    const analys = renderToStaticMarkup(createElement(AnalysPending));
    const hem = renderToStaticMarkup(createElement(HemPending));
    const route = renderToStaticMarkup(createElement(ViewLoading));
    const oldHem = renderToStaticMarkup(createElement(HomeViewLoading));
    const oldAnalys = renderToStaticMarkup(createElement(AnalysViewLoading));

    expect(analys).toContain("Hämtar analysen");
    expect(analys).toContain("Perioden");
    expect(analys).toContain("Månad");
    expect(analys).toContain("Vart gick pengarna");
    expect(analys).toContain("Hur går det");
    expect(analys).toContain("Se vart pengarna gick");
    expect(analys).not.toContain("Kvar idag");
    expect(analysSrc).toContain("analysPendingHasExpired");
    expect(analysSrc).toContain("AnalysFailSoft");
    expect(analysSrc).not.toContain("RetryLoadButton");
    expect(analysSrc).toContain("useState(analysPendingHasExpired)");
    expect(analysSrc).not.toMatch(
      /if \(analysPendingHasExpired\(\)\) \{\s*setGiveUp\(true\)/,
    );
    expect(analys).not.toContain("kvar i perioden");
    expect(analys).not.toContain("h-[10.5rem]");
    expect(hem).toContain("Hämtar läget");
    expect(hem).not.toContain("h-[22rem]");
    expect(route).toContain("Laddar");
    expect(route).not.toContain("h-[11.5rem]");
    expect(oldHem).toContain("h-[22rem]");
    expect(oldAnalys).toContain("h-[10.5rem]");
  });
});
