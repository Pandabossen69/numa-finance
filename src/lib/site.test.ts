import { describe, expect, it } from "vitest";
import {
  isCanonicalAppHost,
  productionUrlForPath,
  shouldRedirectToProduction,
} from "./site";

describe("canonical production host", () => {
  it("accepts production and localhost", () => {
    expect(isCanonicalAppHost("numa-finance.vercel.app")).toBe(true);
    expect(isCanonicalAppHost("localhost")).toBe(true);
  });

  it("redirects temporary vercel hosts to production", () => {
    expect(
      shouldRedirectToProduction("hugo-throsandher-s-projects.vercel.app"),
    ).toBe(true);
    expect(
      shouldRedirectToProduction(
        "numa-finance-git-cursor-sms-hem-update-88ec.vercel.app",
      ),
    ).toBe(true);
    expect(shouldRedirectToProduction("numa-finance.vercel.app")).toBe(false);
  });

  it("allows ?preview=1 escape hatch", () => {
    const params = new URLSearchParams("preview=1");
    expect(
      shouldRedirectToProduction(
        "numa-finance-git-foo.vercel.app",
        params,
      ),
    ).toBe(false);
  });

  it("builds production URLs", () => {
    expect(productionUrlForPath("/idag")).toBe(
      "https://numa-finance.vercel.app/idag",
    );
  });
});
