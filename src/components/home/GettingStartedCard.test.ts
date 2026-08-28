import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  new URL("./GettingStartedCard.tsx", import.meta.url),
  "utf8",
);

describe("GettingStartedCard", () => {
  it("minimizes in place to a Kom igång chip and can restore", () => {
    expect(src).toContain("Kom igång");
    expect(src).toContain("collapseGettingStartedAction");
    expect(src).toContain("expandGettingStartedAction");
    expect(src).toContain("completeGettingStartedAction");
    expect(src).toContain("gettingStartedProgressLabel");
    expect(src).toContain("numa-komigang-body");
    expect(src).toContain("w-full min-w-0");
    expect(src).toContain("md:grid-cols-3");
    expect(src).not.toContain("max-w-xl");
    expect(src).not.toMatch(/spotlight/i);
    expect(src).not.toMatch(/välkommen/i);
  });

  it("hides Kom igång without refreshing the page", () => {
    expect(src).toContain("rememberGettingStarted");
    expect(src).not.toContain("router.refresh");
    expect(src).not.toContain("useRouter");
  });

  it("keeps Kom igång chrome at 44px on the phone", () => {
    expect(src).toContain("flex min-h-11 items-center");
    expect(src).toContain("flex h-11 w-11 shrink-0");
    expect(src).toContain("flex min-h-11 w-full min-w-0");
    expect(src).toContain("min-h-14");
  });
});
