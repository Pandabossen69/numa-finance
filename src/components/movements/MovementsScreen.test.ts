import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./MovementsScreen.tsx", import.meta.url), "utf8");

describe("Rörelser expense color", () => {
  it("paints Utgifter and negative Netto in clay alarm", () => {
    expect(src).toContain('label="Utgifter"');
    expect(src).toContain('tone="alarm"');
    expect(src).toContain('tone={net >= 0 ? "positive" : "alarm"}');
    expect(src).not.toMatch(/label="Utgifter"[\s\S]{0,80}tone="danger"/);
  });
});
