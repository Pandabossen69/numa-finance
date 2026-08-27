import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./AnalysDashboard.tsx", import.meta.url), "utf8");

describe("Analys month result color", () => {
  it("uses clay alarm for Minus mot planen, not destroy red", () => {
    expect(src).toContain('tone={month.monthResultMinor >= 0 ? "positive" : "alarm"}');
    expect(src).toContain('tone={month.freeToSpendMinor >= 0 ? "positive" : "alarm"}');
    expect(src).not.toMatch(/monthResultMinor >= 0 \? "positive" : "danger"/);
    expect(src).not.toMatch(/freeToSpendMinor >= 0 \? "positive" : "danger"/);
  });

  it("labels month leftover as Mot planen, not cash", () => {
    expect(src).toContain("livingLabel={SV.motPlanen}");
    expect(src).toContain("inte kontanter");
  });

  it("restores Perioden/Månad when the dashboard remounts", () => {
    expect(src).toContain("lastAnalysScope");
    expect(src).toContain("rememberAnalysScope");
  });

  it("gives Analys scope chips a 44px tap target", () => {
    expect(src).toContain("min-h-11");
    expect(src).not.toContain("min-h-10");
  });

  it("labels days until next income as idag / N dagar kvar", () => {
    expect(src).toContain("formatDaysUntilSv");
    expect(src).toContain("cycle.nextIncomeLabelSv");
    expect(src).not.toContain('formatCountSv(cycle.daysLeft, "dag", "dagar")');
  });

  it("does not send empty Mål to a dead Lägg till on Plan", () => {
    expect(src).toContain("Avsätt sparande under Plan");
    expect(src).not.toContain("Lägg till →");
  });

  it("lets the Analys header wrap so the formula panel can sit above the tabs", () => {
    expect(src).toContain("flex flex-wrap items-start justify-between");
  });
});
