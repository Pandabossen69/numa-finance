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
const boot = readFileSync(
  new URL("../../../components/auth/LoginBoot.tsx", import.meta.url),
  "utf8",
);

/**
 * SPEC 6 Christian-bar: usable Hem ≤300ms after login (cached totals /
 * skeleton OK). "Loggar in…" must never stretch multi-seconds. #107 still
 * forbids hydrate alone as confirmed live kvar/Över.
 */
describe("login → Hem usable shell (Christian-bar)", () => {
  it("hard-caps Loggar in and clears boot on shell mount", () => {
    expect(boot).toContain("LOGIN_BOOT_MAX_MS");
    expect(boot).toContain("300");
    expect(auth).toContain("LOGIN_BOOT_MAX_MS");
    expect(shell).toContain("LoginBootClear");
    expect(hem).toContain("useLayoutEffect");
    expect(hem).toContain("clearLoginBoot");
    expect(hem.indexOf("useLayoutEffect")).toBeLessThan(
      hem.indexOf("fetchHomeSnapshot"),
    );
  });

  it("paints same-user login shell or Hem skeleton, never hydrate alone", () => {
    expect(auth).toContain("enableHomeLoginShell");
    expect(first).toContain("lastHomeShellSnapshot");
    expect(first).toContain("HomeViewLoading");
    expect(first).toContain("adoptSnap={false}");
    expect(first).not.toContain("lastHomeSnapshot()");
    expect(first).not.toContain("readLastHomeCookie");
    expect(hem).toContain("lastHomeShellSnapshot");
  });

  it("keeps #107 session-confirm gate for live money", () => {
    expect(last).toContain("homeSessionConfirmed");
    expect(last).toContain("invalidateHomeSessionPaint");
    expect(last).toContain("enableHomeLoginShell");
    expect(last).toContain("lastHomeShellSnapshot");
    expect(hem).toContain("lastSessionHomeSnapshot");
    expect(hem).toContain("rememberHomeSnapshot");
    expect(hem).toContain("adoptSnap=");
  });
});
