import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const boot = readFileSync(new URL("./LoginBoot.tsx", import.meta.url), "utf8");
const auth = readFileSync(new URL("./AuthExperience.tsx", import.meta.url), "utf8");
const hem = readFileSync(new URL("../home/HemRouteClient.tsx", import.meta.url), "utf8");
const onboarding = readFileSync(
  new URL("../../app/(onboarding)/layout.tsx", import.meta.url),
  "utf8",
);
const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

describe("LoginBoot", () => {
  it("is a branded Swedish boot screen, not a blank wait", () => {
    expect(boot).toContain("Loggar in i NUMA…");
    expect(boot).toContain("Ett ögonblick.");
    expect(boot).toContain("auth-stage");
    expect(boot).toContain("auth-boot");
    expect(boot).toContain("auth-mark");
    expect(boot).toContain("BRAND_MARK");
    expect(boot).not.toContain('src="/icons/mark.png"');
    expect(boot).toContain('aria-live={announced ? "polite" : undefined}');
    expect(boot).toContain('aria-busy="true"');
    expect(boot).toContain('aria-label="Loggar in i NUMA"');
    expect(boot).toContain("LOGIN_BOOT_TIMEOUT_MS");
    expect(boot).toContain("flushSync");
    expect(boot).toContain("createRoot");
    expect(css).toContain(".auth-boot");
    expect(css).toContain(".auth-boot-title");
  });

  it("is kicked from login success and cleared on shell mount, not money fetch", () => {
    expect(auth).toContain("paintLoginBoot");
    expect(auth).toContain("clearLoginBoot");
    expect(hem).toContain("clearLoginBoot");
    expect(hem).toContain("useLayoutEffect");
    expect(onboarding).toContain("LoginBootClear");
    const shell = readFileSync(
      new URL("../layout/AppShell.tsx", import.meta.url),
      "utf8",
    );
    expect(shell).toContain("LoginBootClear");
    // Must not wait for rememberHomeSnapshot before clearing boot.
    const clearIdx = hem.indexOf("useLayoutEffect");
    const fetchIdx = hem.indexOf("fetchHomeSnapshot");
    expect(clearIdx).toBeGreaterThan(-1);
    expect(fetchIdx).toBeGreaterThan(-1);
    expect(clearIdx).toBeLessThan(fetchIdx);
  });
});
