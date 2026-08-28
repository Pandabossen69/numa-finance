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
    expect(src).toContain("Logga in med e-post och lösenord.");
    expect(src).toContain("auth-card");
    expect(src).toContain("auth-mark");
    expect(src).not.toMatch(/välkommen/i);
    expect(src).toContain("result.nextPath");
    expect(src).toContain("clearClientSessionMemory");
    expect(src).not.toContain('router.replace("/idag")');
    expect(src).toContain('router.prefetch("/kom-igang")');
    expect(src).toContain('router.prefetch("/idag")');
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
