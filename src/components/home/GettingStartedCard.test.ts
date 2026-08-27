import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  new URL("./GettingStartedCard.tsx", import.meta.url),
  "utf8",
);

describe("GettingStartedCard", () => {
  it("minimizes to a Kom igång chip and can restore", () => {
    expect(src).toContain("Kom igång");
    expect(src).toContain("collapseGettingStartedAction");
    expect(src).toContain("expandGettingStartedAction");
    expect(src).toContain("completeGettingStartedAction");
    expect(src).toContain("gettingStartedProgressLabel");
    expect(src).toContain("max-w-xl");
    expect(src).not.toMatch(/spotlight/i);
    expect(src).not.toMatch(/välkommen/i);
  });
});
