import { describe, expect, it } from "vitest";
import {
  hasPreviewEscape,
  isCanonicalAppHost,
  isProductionAppHost,
  productionUrlForPath,
  shouldRedirectToProduction,
  withPreviewQuery,
} from "./site";

describe("canonical production host", () => {
  it("accepts production and localhost", () => {
    expect(isCanonicalAppHost("numa-finance.vercel.app")).toBe(true);
    expect(isCanonicalAppHost("localhost")).toBe(true);
    expect(isProductionAppHost("numa-finance.vercel.app")).toBe(true);
    expect(isProductionAppHost("localhost")).toBe(false);
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
    expect(
      shouldRedirectToProduction(
        "numa-finance-git-foo.vercel.app",
        new URLSearchParams(),
        "numa_preview=1",
      ),
    ).toBe(false);
    expect(hasPreviewEscape(params)).toBe(true);
    expect(withPreviewQuery("/idag")).toBe("/idag?preview=1");
    expect(withPreviewQuery("/idag?foo=bar")).toBe("/idag?foo=bar&preview=1");
  });

  it("builds production URLs", () => {
    expect(productionUrlForPath("/idag")).toBe(
      "https://numa-finance.vercel.app/idag",
    );
  });
});
