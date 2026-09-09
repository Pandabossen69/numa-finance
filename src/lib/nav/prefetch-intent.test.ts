import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { canPrefetchHref, prefetchHref } from "./prefetch-intent";

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
    expect(src).toContain("scheduleIdleWarm");
    expect(src).toContain("requestIdleCallback");
  });

  it("calls router.prefetch with only the href so comments cannot imply a full payload", () => {
    const prefetch = vi.fn();
    prefetchHref({ prefetch } as never, "/fota");
    expect(prefetch).toHaveBeenCalledTimes(1);
    expect(prefetch).toHaveBeenCalledWith("/fota");
    expect(prefetch.mock.calls[0][1]).toBeUndefined();
    // SPA keep-alive tabs must not RSC-prefetch — that raced taps for seconds.
    prefetchHref({ prefetch } as never, "/plan");
    expect(prefetch).toHaveBeenCalledTimes(1);
    prefetchHref({ prefetch } as never, "https://example.com");
    expect(prefetch).toHaveBeenCalledTimes(1);
  });
});
