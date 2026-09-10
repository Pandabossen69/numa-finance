import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./BrandLockup.tsx", import.meta.url), "utf8");

describe("BrandLockup", () => {
  it("uses the cache-busted mark tile beside the NUMA wordmark", () => {
    expect(src).toContain("BRAND_MARK");
    expect(src).toContain("numa-brand-lockup");
    expect(src).toContain("numa-brand-lockup-icon");
    expect(src).toContain("numa-brand-mark");
    expect(src).toContain('aria-label="NUMA"');
  });
});
