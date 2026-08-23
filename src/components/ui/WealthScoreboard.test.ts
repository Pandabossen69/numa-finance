import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./WealthScoreboard.tsx", import.meta.url), "utf8");

describe("CompactPiles Mot planen", () => {
  it("keeps amount and THB on one line and does not clip long overspend copy", () => {
    expect(src).toContain("wrap={false}");
    expect(src).toContain("Mer än planerat.");
    expect(src).not.toContain("Du har handlat mer än månaden planerat.");
    expect(src).toContain("min-h-[2.5rem]");
  });
});
