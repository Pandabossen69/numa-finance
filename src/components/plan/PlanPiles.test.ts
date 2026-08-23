import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./PlanPiles.tsx", import.meta.url), "utf8");

describe("Sparande empty state and Avsätt", () => {
  it("keeps a calm empty state and a Belopp placeholder", () => {
    expect(src).toContain("Inget avsatt än");
    expect(src).toContain('placeholder="Belopp"');
    expect(src).not.toContain('placeholder="0"');
  });
});
