import { describe, expect, it } from "vitest";
import {
  isRscOrPrefetchRequest,
  isSupabaseAuthTokenCookie,
  readAccessTokenExpiryMs,
  shouldSkipProxyGetUser,
} from "./proxy-auth";

function jwtWithPayload(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8")
    .toString("base64url")
    .replace(/=+$/, "");
  return `hdr.${encoded}.sig`;
}

function jwtWithExp(exp: number): string {
  return jwtWithPayload({ exp });
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

  it("only treats real sb-*-auth-token cookies as session cookies", () => {
    expect(isSupabaseAuthTokenCookie("sb-xxx-auth-token")).toBe(true);
    expect(isSupabaseAuthTokenCookie("sb-xxx-auth-token.0")).toBe(true);
    expect(isSupabaseAuthTokenCookie("sb-xxx-auth-token.1")).toBe(true);
    expect(isSupabaseAuthTokenCookie("sb-xxx-api-token")).toBe(false);
    expect(isSupabaseAuthTokenCookie("sb-xxx")).toBe(false);
    expect(isSupabaseAuthTokenCookie("evil-auth-token")).toBe(false);
    expect(isSupabaseAuthTokenCookie("sb-xxx-auth-token-code-verifier")).toBe(
      false,
    );
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

  it("skips getUser on RSC only when the parsed JWT exp is more than 30s ahead", () => {
    const now = 1_700_000_000_000;
    expect(
      shouldSkipProxyGetUser({
        hasAuthCookie: true,
        isRscOrPrefetch: true,
        tokenExpiresAtMs: now + 120_000,
        nowMs: now,
      }),
    ).toBe(true);
    expect(
      shouldSkipProxyGetUser({
        hasAuthCookie: true,
        isRscOrPrefetch: true,
        tokenExpiresAtMs: now + 30_000,
        nowMs: now,
      }),
    ).toBe(false);
  });

  it("does not skip getUser when the access token is expired", () => {
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

  it("does not skip getUser when expiry cannot be parsed", () => {
    expect(
      shouldSkipProxyGetUser({
        hasAuthCookie: true,
        isRscOrPrefetch: true,
        tokenExpiresAtMs: null,
        nowMs: Date.now(),
      }),
    ).toBe(false);
  });

  it("ignores an unparseable auth-token cookie", () => {
    expect(
      readAccessTokenExpiryMs([
        { name: "sb-xxx-auth-token", value: "not-json%%%" },
      ]),
    ).toBeNull();
  });

  it("ignores an irrelevant sb-* cookie even if it looks like a session", () => {
    expect(
      readAccessTokenExpiryMs([
        {
          name: "sb-xxx-api-token",
          value: JSON.stringify({ access_token: jwtWithExp(1_900_000_000) }),
        },
      ]),
    ).toBeNull();
    expect(
      readAccessTokenExpiryMs([
        {
          name: "sb-xxx",
          value: JSON.stringify({ access_token: jwtWithExp(1_900_000_000) }),
        },
      ]),
    ).toBeNull();
  });

  it("returns null when the JWT has no exp", () => {
    expect(
      readAccessTokenExpiryMs([
        {
          name: "sb-xxx-auth-token",
          value: JSON.stringify({ access_token: jwtWithPayload({ sub: "u1" }) }),
        },
      ]),
    ).toBeNull();
  });

  it("reads JWT exp from a valid chunked auth-token cookie", () => {
    expect(
      readAccessTokenExpiryMs([
        { name: "sb-xxx-auth-token.0", value: '{"access_token":"' },
        {
          name: "sb-xxx-auth-token.1",
          value: `${jwtWithExp(1_800_000_000)}","expires_at":1800000000}`,
        },
      ]),
    ).toBe(1_800_000_000_000);
  });
});
