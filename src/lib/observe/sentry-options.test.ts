import { describe, expect, it } from "vitest";
import {
  getSentryInitOptions,
  resolveSentryDsn,
  resolveSentryEnvironment,
  resolveSentryRelease,
  scrubSentryEvent,
  stripQueryAndFragment,
} from "./sentry-options";

describe("resolveSentryEnvironment", () => {
  it("prefers Vercel preview over NODE_ENV production", () => {
    expect(
      resolveSentryEnvironment({
        VERCEL_ENV: "preview",
        NODE_ENV: "production",
      }),
    ).toBe("preview");
  });

  it("tags production only when Vercel says production", () => {
    expect(
      resolveSentryEnvironment({
        VERCEL_ENV: "production",
        NODE_ENV: "production",
      }),
    ).toBe("production");
  });

  it("lets SENTRY_ENVIRONMENT win", () => {
    expect(
      resolveSentryEnvironment({
        SENTRY_ENVIRONMENT: "preview",
        VERCEL_ENV: "production",
      }),
    ).toBe("preview");
  });
});

describe("resolveSentryDsn", () => {
  it("reads SENTRY_DSN first", () => {
    expect(
      resolveSentryDsn({
        SENTRY_DSN: "https://key@o1.ingest.sentry.io/1",
        NEXT_PUBLIC_SENTRY_DSN: "https://other@o1.ingest.sentry.io/2",
      }),
    ).toBe("https://key@o1.ingest.sentry.io/1");
  });

  it("falls back to NEXT_PUBLIC_SENTRY_DSN", () => {
    expect(
      resolveSentryDsn({
        NEXT_PUBLIC_SENTRY_DSN: "https://public@o1.ingest.sentry.io/3",
      }),
    ).toBe("https://public@o1.ingest.sentry.io/3");
  });
});

describe("resolveSentryRelease", () => {
  it("uses the Vercel commit SHA when no explicit release is set", () => {
    expect(resolveSentryRelease({ VERCEL_GIT_COMMIT_SHA: "abc123" })).toBe("abc123");
  });
});

describe("scrubSentryEvent", () => {
  it("drops user, cookies, headers, bodies, and query strings", () => {
    const event = scrubSentryEvent({
      user: { email: "hugo@example.com", ip_address: "1.2.3.4" },
      request: {
        url: "https://numa.test/idag?preview=1&token=secret",
        cookies: { sb: "session" },
        headers: { authorization: "Bearer secret" },
        data: { amount: 12000, description: "Hyra" },
        query_string: "preview=1",
      },
      extra: {
        itemId: "item-1",
        saldo: 44000,
        email: "hugo@example.com",
      },
    });

    expect(event.user).toEqual({});
    expect(event.request?.cookies).toBeUndefined();
    expect(event.request?.headers).toBeUndefined();
    expect(event.request?.data).toBeUndefined();
    expect(event.request?.query_string).toBeUndefined();
    expect(event.request?.url).toBe("https://numa.test/idag");
    expect(event.extra).toEqual({
      itemId: "item-1",
      saldo: "[filtered]",
      email: "[filtered]",
    });
  });
});

describe("stripQueryAndFragment", () => {
  it("keeps origin and path only", () => {
    expect(stripQueryAndFragment("https://numa.test/fota?x=1#y")).toBe(
      "https://numa.test/fota",
    );
  });
});

describe("getSentryInitOptions", () => {
  it("disables PII collection and tags preview", () => {
    const options = getSentryInitOptions({
      SENTRY_DSN: "https://key@o1.ingest.sentry.io/1",
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_SHA: "deadbeef",
      NODE_ENV: "production",
    });
    expect(options.dsn).toBe("https://key@o1.ingest.sentry.io/1");
    expect(options.environment).toBe("preview");
    expect(options.release).toBe("deadbeef");
    expect(options.sendDefaultPii).toBe(false);
    expect(options.enableLogs).toBe(false);
    expect(options.dataCollection.userInfo).toBe(false);
    expect(options.dataCollection.httpBodies).toEqual([]);
    expect(options.dataCollection.stackFrameVariables).toBe(false);
  });
});
