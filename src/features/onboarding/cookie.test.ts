import { describe, expect, it } from "vitest";
import {
  ONBOARDING_COOKIE,
  onboardingCookieOptions,
  parseOnboardingCookie,
} from "./cookie";

describe("onboarding cookie", () => {
  it("parses only saldo and done", () => {
    expect(parseOnboardingCookie("saldo")).toBe("saldo");
    expect(parseOnboardingCookie("done")).toBe("done");
    expect(parseOnboardingCookie("")).toBeNull();
    expect(parseOnboardingCookie("skip")).toBeNull();
    expect(parseOnboardingCookie(undefined)).toBeNull();
  });

  it("is httpOnly on the whole site", () => {
    expect(ONBOARDING_COOKIE).toBe("numa-onboard");
    const options = onboardingCookieOptions();
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    expect(options.maxAge).toBeGreaterThan(60 * 60 * 24 * 30);
  });
});
