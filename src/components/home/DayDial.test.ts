import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./DayDial.tsx", import.meta.url), "utf8");

describe("DayDial remaining ring", () => {
  it("draws remaining budget, not spent fill, so a full day looks alive", () => {
    expect(src).toContain("remainRatio");
    expect(src).toContain("1 - Math.min(1, usedRatio)");
    expect(src).not.toContain("usedStroke");
  });

  it("never grows wider than its Hem card on a 375px phone", () => {
    expect(src).toContain("max-w-[min(15.5rem,100%)]");
    expect(src).toContain("overflow-visible");
    expect(src).toContain("min-w-0");
  });
});
