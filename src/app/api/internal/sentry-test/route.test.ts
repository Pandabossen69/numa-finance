import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

describe("sentry test route", () => {
  it("stays gated and throws only the isolated verification error", () => {
    expect(src).toContain("isSentryTestRouteEnabled");
    expect(src).toContain("isSentryTestConfirmed");
    expect(src).toContain("SENTRY_TEST_ERROR_MESSAGE");
    expect(src).toContain("status: 404");
  });
});
