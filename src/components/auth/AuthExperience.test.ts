import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./AuthExperience.tsx", import.meta.url), "utf8");

describe("AuthExperience — public signup closed", () => {
  it("has login only, no create-account path", () => {
    expect(src).toContain("signInAction");
    expect(src).not.toContain("signUpAction");
    expect(src).not.toContain("signup-email");
    expect(src).not.toContain("signup-password");
    expect(src).not.toContain("Skapa konto");
    expect(src).not.toContain("onCreateAccount");
    expect(src).toContain("Logga in");
    expect(src).toContain("Konto skapas av NUMA");
    expect(src).toContain("Logga in med e-post och lösenord");
    expect(src).toContain("auth-card");
    expect(src).toContain("auth-mark");
    expect(src).toContain("BRAND_MARK");
    expect(src).not.toContain('src="/icons/mark.png"');
    expect(src).toContain("auth-mark-icon");
    expect(src).toContain("auth-frame");
    expect(src).toContain("auth-hero");
    expect(src).toContain("Vad du kan använda idag.");
    expect(src).not.toContain("WelcomeScreen");
    expect(src).not.toContain("Tillbaka");
    expect(src).not.toMatch(/välkommen/i);
    expect(src).toContain("result.nextPath");
    expect(src).toContain(
      "router.replace(preview ? withPreviewQuery(result.nextPath) : result.nextPath)",
    );
    expect(src).not.toContain("PRODUCTION_ORIGIN");
    expect(src).not.toContain("numa-finance.vercel.app");
    expect(src).not.toContain('router.replace("/idag")');
    expect(src).toContain('router.prefetch("/kom-igang")');
    expect(src).toContain('router.prefetch("/idag")');
  });
});

describe("AuthExperience — login boot (Christian-bar)", () => {
  it("never paints Loggar in overlay after success — shell under AppShell", () => {
    expect(src).toContain("enableHomeLoginShell");
    expect(src).toContain("kickPostLoginWarm");
    expect(src).toContain("fetchHomeSnapshot");
    expect(src).toContain("rememberHomeSnapshot");
    expect(src).toContain("clearLoginBoot");
    expect(src).toContain("aria-busy={pending || undefined}");
    expect(src).not.toContain("paintLoginBoot");
    expect(src).not.toContain("setBooting(true)");

    const success = src.slice(
      src.indexOf("if (!result.ok)"),
      src.indexOf("router.replace(preview"),
    );
    expect(success).toContain("bindSessionOwner(result.userId)");
    expect(success).toContain("invalidateHomeSessionPaint");
    expect(success).toContain("enableHomeLoginShell");
    expect(success).toContain("kickPostLoginWarm");
    expect(success).toContain("clearLoginBoot");
    expect(success).not.toContain("paintLoginBoot");
    expect(success).not.toContain("clearClientSessionCaches");
    expect(success).not.toContain("router.refresh()");
    expect(success.indexOf("invalidateHomeSessionPaint")).toBeLessThan(
      success.indexOf("enableHomeLoginShell"),
    );
    expect(success.indexOf("enableHomeLoginShell")).toBeLessThan(
      success.indexOf("kickPostLoginWarm"),
    );

    const kick = src.slice(
      src.indexOf("function kickPostLoginWarm"),
      src.indexOf("export function AuthExperience"),
    );
    expect(kick.indexOf("fetchHomeSnapshot")).toBeLessThan(
      kick.indexOf("scheduleQuietMenuWarm"),
    );
    expect(kick.indexOf("scheduleQuietMenuWarm")).toBeLessThan(
      kick.indexOf("rememberHomeSnapshot"),
    );

    const failStart = src.indexOf(
      "if (!result.ok)",
      src.indexOf("function submitLogin"),
    );
    const fail = src.slice(failStart, src.indexOf("return;", failStart));
    expect(fail).toContain("clearLoginBoot");
    expect(fail).toContain("setError(result.error)");
  });
});

describe("sign-in next path", () => {
  it("routes new users into onboarding from the login action", () => {
    const actions = readFileSync(
      new URL("../../features/auth/actions.ts", import.meta.url),
      "utf8",
    );
    expect(actions).toContain("loadOnboardingState");
    expect(actions).toContain("persistOnboardingPhaseCookie");
    expect(actions).toContain("nextPath: state.nextPath");
    expect(actions).toContain("clearOnboardingCookie");
  });
});
