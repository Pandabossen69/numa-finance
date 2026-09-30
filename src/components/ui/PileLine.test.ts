import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./PileLine.tsx", import.meta.url), "utf8");

describe("PileLine cash rows", () => {
  it("locks every coverage row to the same sm MoneyDisplay", () => {
    expect(src).toContain("numa-pile-line");
    expect(src).toContain("numa-pile-line-label");
    expect(src).toContain('size="sm"');
    expect(src).toContain("wrap={false}");
    expect(src).not.toContain('size="xs"');
    expect(src).not.toContain('size="md"');
    expect(src).not.toContain('size="lg"');
  });

  it("colors Över as over/short and amounts under 0, without a spend color on ut", () => {
    expect(src).toContain('tone === "over"');
    expect(src).toContain('tone === "short"');
    expect(src).toContain("usesAlarmColor(amountMinor)");
    expect(src).toContain('? "signed"');
    expect(src).not.toContain("numa-amt-out");
  });
});
