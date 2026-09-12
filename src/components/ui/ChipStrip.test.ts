import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./ChipStrip.tsx", import.meta.url), "utf8");

describe("ChipStrip", () => {
  it("reserves opaque ‹/› slots and hides mid-glyph clips", () => {
    expect(src).toContain("numa-month-strip-shell");
    expect(src).toContain("numa-month-strip-slot");
    expect(src).toContain("is-clipped");
    expect(src).toContain("cloneElement");
    expect(src).toContain("snapScrollLeft");
    expect(src).toContain("startLabel");
    expect(src).toContain("endLabel");
    expect(src).toContain("activeSelector");
    expect(src).toContain("lastActiveSig");
    expect(src).toContain("right - el.clientWidth");
  });
});
