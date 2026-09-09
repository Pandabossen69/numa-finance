import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./NavWarmup.tsx", import.meta.url), "utf8");

describe("NavWarmup", () => {
  it("does not RSC-prefetch SPA keep-alive tabs", () => {
    expect(src).toContain("isSpaTabHref");
    expect(src).toContain("scheduleQuietMenuWarm");
    expect(src).toContain("filter((href) => !isSpaTabHref(href))");
    expect(src).not.toMatch(/warmHrefs\([\s\S]*PRIMARY_NAV\.map\(\(item\) => item\.href\)\s*,/);
    expect(src).toContain("scheduleIdleWarm(warm)");
  });
});
