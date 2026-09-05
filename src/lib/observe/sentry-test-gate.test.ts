import { describe, expect, it } from "vitest";
import { isSentryTestConfirmed, isSentryTestRouteEnabled } from "./sentry-test-gate";

describe("isSentryTestRouteEnabled", () => {
  it("is closed in production", () => {
    expect(
      isSentryTestRouteEnabled({
        VERCEL_ENV: "production",
        NODE_ENV: "production",
      }),
    ).toBe(false);
  });

  it("is open on Vercel preview", () => {
    expect(
      isSentryTestRouteEnabled({
        VERCEL_ENV: "preview",
        NODE_ENV: "production",
      }),
    ).toBe(true);
  });

  it("can be force-disabled", () => {
    expect(
      isSentryTestRouteEnabled({
        VERCEL_ENV: "preview",
        SENTRY_TEST_ROUTE: "0",
      }),
    ).toBe(false);
  });
});

describe("isSentryTestConfirmed", () => {
  it("requires confirm=1 so crawlers do not trip Slack", () => {
    expect(isSentryTestConfirmed(new URLSearchParams())).toBe(false);
    expect(isSentryTestConfirmed(new URLSearchParams("confirm=1"))).toBe(true);
  });
});
