import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./PlanPiles.tsx", import.meta.url), "utf8");

describe("Sparande empty state and Avsätt", () => {
  it("keeps a calm empty state and a Swedish amount placeholder", () => {
    expect(src).toContain("Sätt av det som inte ska levas upp.");
    expect(src).toContain("Inte ännu");
    expect(src).toContain('placeholder="t.ex. 2 000"');
    expect(src).not.toContain('placeholder="0"');
    expect(src).not.toContain("Inget avsatt än");
  });
});
