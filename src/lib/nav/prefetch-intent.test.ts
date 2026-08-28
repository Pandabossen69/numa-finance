import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canPrefetchHref } from "./prefetch-intent";

describe("prefetch-intent", () => {
  it("prefetches in-app paths and skips production https links", () => {
    expect(canPrefetchHref("/transaktioner")).toBe(true);
    expect(canPrefetchHref("/konton")).toBe(true);
    expect(canPrefetchHref("https://numa.example")).toBe(false);
    expect(canPrefetchHref("//evil.example")).toBe(false);
  });

  it("warms destinations on hover, focus, and visibility", () => {
    const src = readFileSync(new URL("./prefetch-intent.ts", import.meta.url), "utf8");
    expect(src).toContain("router.prefetch");
    expect(src).toContain("visibilitychange");
    expect(src).toContain("usePrefetchOnIntent");
  });
});
