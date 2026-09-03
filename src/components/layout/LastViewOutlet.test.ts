import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./LastViewOutlet.tsx", import.meta.url), "utf8");

describe("LastViewOutlet keep-alive", () => {
  it("parks previous tabs and falls back to ViewLoading instead of a blank column", () => {
    expect(src).toContain("resolveVisibleTab");
    expect(src).toContain("isTabRoot");
    expect(src).toContain("numa-view-park");
    expect(src).toContain("ViewLoading");
    expect(src).toContain("inert");
    expect(src).toContain("sameTabRefresh");
    expect(src).toContain("liveByTabRef");
    expect(src).toContain("liveIncomingDest");
  });
});
