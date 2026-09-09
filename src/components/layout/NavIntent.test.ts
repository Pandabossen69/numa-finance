import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./NavIntent.tsx", import.meta.url), "utf8");

describe("NavIntent", () => {
  it("keeps last intent after the URL matches dest until dest children arrive", () => {
    expect(src).toContain("intent");
    expect(src).toContain("clearIntent");
    expect(src).toContain("setIntent(next)");
    expect(src).toContain("optimisticNavPath(");
    expect(src).toContain("resolvedPending ?? intent");
    expect(src).not.toContain("setAwaitingHref");
  });

  it("exposes SPA keep-alive navigation for primary tabs", () => {
    expect(src).toContain("spaActive");
    expect(src).toContain("navigateSpaTab");
    expect(src).toContain("isSpaTabHref");
    expect(src).toContain("window.history.pushState");
    expect(src).toContain("setSpaPath");
  });
});

  it("intercepts in-app SPA tab links so App Router soft-nav never starts", () => {
    expect(src).toContain("pointerdown");
    expect(src).toContain("addEventListener(\"click\"");
    expect(src).toContain("paintSpaPanelsNow");
    expect(src).toContain("numa-view-park");
  });
