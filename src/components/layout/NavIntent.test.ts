import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./NavIntent.tsx", import.meta.url), "utf8");

describe("NavIntent", () => {
  it("keeps last intent after the URL matches dest until dest children arrive", () => {
    expect(src).toContain("intent");
    expect(src).toContain("clearIntent");
    expect(src).toContain("setIntent(next)");
    expect(src).toContain("optimisticNavPath(pathname, resolvedPending ?? intent)");
    expect(src).not.toContain("setAwaitingHref");
  });
});
