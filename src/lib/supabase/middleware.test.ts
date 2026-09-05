import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./middleware.ts", import.meta.url), "utf8");

describe("preview host and auth return", () => {
  it("only bounces leftover Vercel hosts via shouldRedirectToProduction", () => {
    expect(src).toContain("shouldRedirectToProduction(");
    expect(src).toContain("PRODUCTION_ORIGIN");
    expect(src).toMatch(/function redirectToProduction/);
  });

  it("keeps login and post-auth navigation on the request host", () => {
    const loginFn = src.slice(
      src.indexOf("function redirectToLogin"),
      src.indexOf("function redirectToProduction"),
    );
    const signedInHome = src.slice(
      src.indexOf('if (user && pathname === "/logga-in")'),
      src.indexOf('if (user && pathname === "/lista")'),
    );
    expect(loginFn).toContain("request.nextUrl.clone()");
    expect(loginFn).toContain('redirectUrl.pathname = "/logga-in"');
    expect(loginFn).not.toContain("PRODUCTION_ORIGIN");
    expect(signedInHome).toContain("request.nextUrl.clone()");
    expect(signedInHome).toContain('redirectUrl.pathname = "/idag"');
    expect(signedInHome).not.toContain("PRODUCTION_ORIGIN");
  });
});
