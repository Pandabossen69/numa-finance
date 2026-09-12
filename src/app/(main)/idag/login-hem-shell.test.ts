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
const auth = readFileSync(
  new URL("../../../components/auth/AuthExperience.tsx", import.meta.url),
  "utf8",
);

/**
 * SPEC 6 Christian-bar: usable Hem ≤300ms (cached totals / skeleton).
 * No multi-second "Loggar in i NUMA…" or blank wait. #107: hydrate is
 * provisional shell only — lastSessionHomeSnapshot stays gated.
 */
describe("login → Hem usable shell (Christian-bar)", () => {
  it("never paints login boot after success; clears leftovers on shell mount", () => {
    expect(auth).not.toContain("paintLoginBoot");
    expect(auth).toContain("clearLoginBoot");
    expect(auth).toContain("enableHomeLoginShell");
    expect(shell).toContain("LoginBootClear");
    expect(hem).toContain("useLayoutEffect");
    expect(hem).toContain("clearLoginBoot");
    expect(hem.indexOf("useLayoutEffect")).toBeLessThan(
      hem.indexOf("fetchHomeSnapshot"),
    );
  });

  it("paints same-user shell from login/warm hydrate; skeleton only when empty", () => {
    expect(last).toContain("homeLoginShell");
    expect(last).toMatch(/homeLoginShell\s*=/);
    expect(last).toContain("seedHomeLoginShell");
    expect(first).toContain("lastHomeShellSnapshot");
    expect(first).toContain("cookieShell");
    expect(first).toContain("HomeViewLoading");
    expect(first).toContain("adoptSnap={false}");
    expect(first).not.toContain("lastHomeSnapshot()");
    expect(hem).toContain("lastHomeShellSnapshot");
    expect(hem).toContain("cookieShell");
    expect(hem).toContain("seedHomeLoginShell");
  });

  it("keeps #107 session-confirm gate for live money", () => {
    expect(last).toContain("homeSessionConfirmed");
    expect(last).toContain("invalidateHomeSessionPaint");
    expect(last).toContain("lastSessionHomeSnapshot");
    expect(last).toContain("lastHomeShellSnapshot");
    expect(hem).toContain("lastSessionHomeSnapshot");
    expect(hem).toContain("rememberHomeSnapshot");
    expect(hem).toContain("adoptSnap=");
  });
});
