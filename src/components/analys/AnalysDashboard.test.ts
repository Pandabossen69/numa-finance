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
});
