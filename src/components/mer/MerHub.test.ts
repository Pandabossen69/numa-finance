import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./MerHub.tsx", import.meta.url), "utf8");

describe("Mer hub layout", () => {
  it("keeps list rows at 44px and meta values on one line", () => {
    expect(src).toContain("min-h-11");
    expect(src).toContain("min-h-[3.25rem]");
    expect(src).toContain("numa-money-line");
    expect(src).toContain("numa-money-line-amt");
    expect(src).toContain("truncate");
  });

  it("prefetches drill-ins on hover and focus", () => {
    expect(src).toContain("onMouseEnter");
    expect(src).toContain("onFocus");
    expect(src).toContain("usePrefetchOnIntent");
    expect(src).toContain("prefetchHref(href)");
  });
});
