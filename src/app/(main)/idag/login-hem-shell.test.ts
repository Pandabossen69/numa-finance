import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hem = readFileSync(
  new URL("../../../components/home/HemRouteClient.tsx", import.meta.url),
  "utf8",
);
const first = readFileSync(
  new URL("../../../components/layout/HemFirstPaint.tsx", import.meta.url),
  "utf8",
);
const shell = readFileSync(
  new URL("../../../components/layout/AppShell.tsx", import.meta.url),
  "utf8",
);
const last = readFileSync(
  new URL("../../../features/home/last-snapshot.ts", import.meta.url),
  "utf8",
);

/**
 * SPEC 6 Christian-bar: after login, drop "Loggar in…" and paint a Hem
 * shell within ~300ms while the snapshot fetch runs. #107 still forbids
 * hydrate/cookie money as live kvar/Över.
 */
describe("login → Hem usable shell", () => {
  it("clears login boot on shell/Hem mount before money arrives", () => {
    expect(shell).toContain("LoginBootClear");
    expect(hem).toContain("useLayoutEffect");
    expect(hem).toContain("clearLoginBoot");
    expect(hem.indexOf("useLayoutEffect")).toBeLessThan(
      hem.indexOf("fetchHomeSnapshot"),
    );
  });

  it("paints Hem-shaped skeleton when session money is not confirmed yet", () => {
    expect(first).toContain("HomeViewLoading");
    expect(first).toContain("lastSessionHomeSnapshot");
    expect(first).not.toContain("lastHomeSnapshot()");
    expect(first).not.toContain("readLastHomeCookie");
  });

  it("keeps #107 session-confirm gate for live money", () => {
    expect(last).toContain("homeSessionConfirmed");
    expect(last).toContain("invalidateHomeSessionPaint");
    expect(hem).toContain("lastSessionHomeSnapshot");
    expect(hem).toContain("rememberHomeSnapshot");
  });
});
