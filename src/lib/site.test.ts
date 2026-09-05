import { describe, expect, it } from "vitest";
import {
  hasPreviewEscape,
  isCanonicalAppHost,
  isProductionAppHost,
  isProjectVercelAlias,
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

  it("keeps this project's preview and deployment aliases on the same host", () => {
    expect(
      isProjectVercelAlias(
        "numa-finance-git-cursor-p0-c-e32a24-hugo-throsandher-s-projects.vercel.app",
      ),
    ).toBe(true);
    expect(
      isProjectVercelAlias(
        "numa-finance-mqwenax7f-hugo-throsandher-s-projects.vercel.app",
      ),
    ).toBe(true);
    expect(isProjectVercelAlias("numa-finance.vercel.app")).toBe(false);
    expect(
      shouldRedirectToProduction(
        "numa-finance-git-cursor-p0-c-e32a24-hugo-throsandher-s-projects.vercel.app",
      ),
    ).toBe(false);
    expect(
      shouldRedirectToProduction(
        "numa-finance-mqwenax7f-hugo-throsandher-s-projects.vercel.app",
      ),
    ).toBe(false);
    expect(shouldRedirectToProduction("numa-finance.vercel.app")).toBe(false);
  });

  it("still redirects leftover team / other-app vercel hosts to production", () => {
    expect(
      shouldRedirectToProduction("hugo-throsandher-s-projects.vercel.app"),
    ).toBe(true);
    expect(
      shouldRedirectToProduction("other-app-git-main.vercel.app"),
    ).toBe(true);
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
