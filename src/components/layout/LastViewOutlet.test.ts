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
  });

  it("does not hand the server a hold state the client disagrees with", () => {
    // The server streams the loading node, so inFlight is true there and false
    // on the client. React does not patch mismatched attributes up, so
    // aria-busy="true" stayed stuck on the main region of every screen.
    expect(src).toContain("useSyncExternalStore");
    expect(src).toContain("const holding = hydrated && inFlight");
    expect(src).toContain('className={holding ? "numa-view numa-view-hold"');
    expect(src).toContain("aria-busy={holding || undefined}");
    expect(src).not.toContain("aria-busy={inFlight || undefined}");
  });
});
