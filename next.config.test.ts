import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./next.config.ts", import.meta.url), "utf8");

describe("payload and cache config", () => {
  it("keeps tab cache warm and tree-shakes date-fns-tz / zod", () => {
    expect(src).toContain("staleTimes");
    expect(src).toContain("optimizePackageImports");
    expect(src).toContain("date-fns-tz");
    expect(src).toContain("zod");
  });

  it("does not let the service worker or icons sit behind a long HTML cache", () => {
    expect(src).toContain('source: "/sw.js"');
    expect(src).toContain("no-store");
    expect(src).toContain('source: "/icons/:path*"');
    expect(src).toContain("stale-while-revalidate");
  });
});
