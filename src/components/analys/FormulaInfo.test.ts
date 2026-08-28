import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./FormulaInfo.tsx", import.meta.url), "utf8");

describe("FormulaInfo popover", () => {
  it("drops into flow on small screens so Perioden/Månad stay tappable", () => {
    expect(src).toContain("max-md:basis-full");
    expect(src).toContain("max-md:relative");
    expect(src).toContain("max-md:w-full");
    expect(src).toContain('event.key === "Escape"');
  });

  it("gives the formula toggle a 44px tap target", () => {
    expect(src).toContain("numa-tap-icon");
    expect(src).not.toContain("h-10 w-10");
  });
});
