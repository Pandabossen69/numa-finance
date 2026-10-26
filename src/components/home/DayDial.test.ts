import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./DayDial.tsx", import.meta.url), "utf8");

describe("DayBudgetBar", () => {
  it("draws remaining budget as a thin bar, not a glowing ring", () => {
    expect(src).toContain("remainRatio");
    expect(src).toContain("1 - Math.min(1, usedRatio)");
    expect(src).toContain("h-1.5");
    expect(src).not.toContain("usedStroke");
    expect(src).not.toContain("numa-day-dial");
    expect(src).not.toContain("<svg");
    expect(src).not.toContain("box-shadow");
  });
});
