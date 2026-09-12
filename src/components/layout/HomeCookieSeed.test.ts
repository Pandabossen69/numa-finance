import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./HomeCookieSeed.tsx", import.meta.url), "utf8");
const layout = readFileSync(
  new URL("../../app/(main)/layout.tsx", import.meta.url),
  "utf8",
);

describe("HomeCookieSeed", () => {
  it("seeds provisional shell without remounting AppShell on cookie await", () => {
    expect(src).toContain("seedHomeLoginShell");
    expect(src).toContain("useLayoutEffect");
    expect(src).not.toContain("rememberHomeSnapshot");
    expect(layout).toContain("HomeCookieSeed");
    expect(layout).toContain("readLastHomeCookie");
    expect(layout).not.toContain("homeCookieShell={");
  });
});
