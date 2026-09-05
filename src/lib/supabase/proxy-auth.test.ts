import { describe, expect, it } from "vitest";
import {
  isRscOrPrefetchRequest,
  readAccessTokenExpiryMs,
  shouldSkipProxyGetUser,
} from "./proxy-auth";

function jwtWithExp(exp: number): string {
  const payload = Buffer.from(JSON.stringify({ exp }), "utf8")
    .toString("base64url")
    .replace(/=+$/, "");
  return `hdr.${payload}.sig`;
}

describe("proxy Auth fast path", () => {
  it("detects RSC and prefetch headers used by App Router", () => {
    expect(isRscOrPrefetchRequest({ get: (name) => (name === "RSC" ? "1" : null) })).toBe(
      true,
    );
    expect(
      isRscOrPrefetchRequest({
        get: (name) => (name === "Next-Router-Prefetch" ? "1" : null),
      }),
    ).toBe(true);
    expect(isRscOrPrefetchRequest({ get: () => null })).toBe(false);
  });

  it("never skips getUser on a full document request", () => {
    expect(
      shouldSkipProxyGetUser({
        hasAuthCookie: true,
        isRscOrPrefetch: false,
        tokenExpiresAtMs: Date.now() + 60_000,
        nowMs: Date.now(),
      }),
    ).toBe(false);
  });

  it("skips getUser on RSC when the cookie is present and the token is fresh", () => {
    const now = 1_700_000_000_000;
    expect(
      shouldSkipProxyGetUser({
        hasAuthCookie: true,
        isRscOrPrefetch: true,
        tokenExpiresAtMs: now + 120_000,
        nowMs: now,
      }),
    ).toBe(true);
  });

  it("does not skip getUser when the access token is clearly expired", () => {
    const now = 1_700_000_000_000;
    expect(
      shouldSkipProxyGetUser({
        hasAuthCookie: true,
        isRscOrPrefetch: true,
        tokenExpiresAtMs: now - 1_000,
        nowMs: now,
      }),
    ).toBe(false);
  });

  it("skips getUser on RSC when expiry cannot be parsed so tab switches stay offline", () => {
    expect(
      shouldSkipProxyGetUser({
        hasAuthCookie: true,
        isRscOrPrefetch: true,
        tokenExpiresAtMs: null,
        nowMs: Date.now(),
      }),
    ).toBe(true);
  });

  it("reads expires_at and JWT exp from chunked auth cookies", () => {
    expect(
      readAccessTokenExpiryMs([
        { name: "sb-xxx-auth-token.0", value: '{"access_token":"' },
        { name: "sb-xxx-auth-token.1", value: `${jwtWithExp(1_800_000_000)}","expires_at":1800000000}` },
      ]),
    ).toBe(1_800_000_000_000);

    expect(
      readAccessTokenExpiryMs([
        {
          name: "sb-xxx-auth-token",
          value: JSON.stringify({ access_token: jwtWithExp(1_900_000_000) }),
        },
      ]),
    ).toBe(1_900_000_000_000);
  });
});
