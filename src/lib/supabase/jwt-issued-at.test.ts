import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  accessTokenFromFetch,
  classifyJwtTime,
  fetchWithJwtIssuedAtRetry,
  isJwtIssuedAtFutureError,
  MAX_IAT_WAIT_MS,
  retryWaitMsForJwtIssuedAtFuture,
  waitMsToPassFutureIat,
} from "./jwt-issued-at";

const NOW_SEC = 1_788_674_400;

function unsignedJwt(claims: Record<string, unknown>): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "none", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.sig`;
}

function pgrst303Body(): string {
  return JSON.stringify({
    code: "PGRST303",
    message: "JWT issued at future",
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("classifyJwtTime", () => {
  it("accepts a normal in-date token whose iat is already in the past", () => {
    const token = unsignedJwt({
      iat: NOW_SEC - 30,
      exp: NOW_SEC + 3600,
      sub: "user",
    });
    expect(classifyJwtTime(token, NOW_SEC)).toBe("valid");
  });

  it("treats a short future iat as retryable clock skew, not as authenticated", () => {
    const token = unsignedJwt({
      iat: NOW_SEC + 1,
      exp: NOW_SEC + 3600,
    });
    expect(classifyJwtTime(token, NOW_SEC)).toBe("retryable_future_iat");
    const waitMs = waitMsToPassFutureIat(NOW_SEC + 1, NOW_SEC);
    expect(waitMs).not.toBeNull();
    expect(waitMs).toBeLessThanOrEqual(MAX_IAT_WAIT_MS);
    expect(NOW_SEC * 1000 + (waitMs ?? 0)).toBeGreaterThan((NOW_SEC + 1) * 1000);
  });

  it("rejects a clearly abnormal future iat", () => {
    const token = unsignedJwt({
      iat: NOW_SEC + 5 * 60,
      exp: NOW_SEC + 3600,
    });
    expect(classifyJwtTime(token, NOW_SEC)).toBe("abnormal_future_iat");
  });

  it("never accepts an expired token, even if iat looks fine", () => {
    const token = unsignedJwt({
      iat: NOW_SEC - 4000,
      exp: NOW_SEC,
    });
    expect(classifyJwtTime(token, NOW_SEC)).toBe("expired");
  });

  it("treats millisecond iat/exp as invalid time units", () => {
    const token = unsignedJwt({
      iat: NOW_SEC * 1000,
      exp: (NOW_SEC + 3600) * 1000,
    });
    expect(classifyJwtTime(token, NOW_SEC)).toBe("invalid");
  });
});

describe("retryWaitMsForJwtIssuedAtFuture", () => {
  it("retries immediately when PostgREST rejects a still-valid token", () => {
    const token = unsignedJwt({
      iat: NOW_SEC - 10,
      exp: NOW_SEC + 3600,
    });
    expect(
      retryWaitMsForJwtIssuedAtFuture({
        status: 401,
        body: pgrst303Body(),
        accessToken: token,
        nowSec: NOW_SEC,
      }),
    ).toBe(0);
  });

  it("waits just past a one-second future iat", () => {
    const token = unsignedJwt({
      iat: NOW_SEC + 1,
      exp: NOW_SEC + 3600,
    });
    const waitMs = retryWaitMsForJwtIssuedAtFuture({
      status: 401,
      body: "JWT issued at future",
      accessToken: token,
      nowSec: NOW_SEC,
    });
    expect(waitMs).toBe(1_050);
    expect(NOW_SEC * 1000 + (waitMs ?? 0)).toBeGreaterThan((NOW_SEC + 1) * 1000);
  });

  it("does not retry a 5s future iat that cannot be waited past in time", () => {
    const token = unsignedJwt({
      iat: NOW_SEC + 5,
      exp: NOW_SEC + 3600,
    });
    expect(classifyJwtTime(token, NOW_SEC)).toBe("abnormal_future_iat");
    expect(waitMsToPassFutureIat(NOW_SEC + 5, NOW_SEC)).toBeNull();
    expect(
      retryWaitMsForJwtIssuedAtFuture({
        status: 401,
        body: "JWT issued at future",
        accessToken: token,
        nowSec: NOW_SEC,
      }),
    ).toBeNull();
  });

  it("does not retry a missing or unparseable bearer token", () => {
    const base = {
      status: 401,
      body: pgrst303Body(),
      nowSec: NOW_SEC,
    };
    expect(
      retryWaitMsForJwtIssuedAtFuture({ ...base, accessToken: null }),
    ).toBeNull();
    expect(
      retryWaitMsForJwtIssuedAtFuture({ ...base, accessToken: "not-a-jwt" }),
    ).toBeNull();
    expect(
      retryWaitMsForJwtIssuedAtFuture({
        ...base,
        accessToken: unsignedJwt({ sub: "user" }),
      }),
    ).toBeNull();
  });

  it("does not retry expired or abnormal future iat or other 401s", () => {
    const expired = unsignedJwt({
      iat: NOW_SEC - 10,
      exp: NOW_SEC - 1,
    });
    const abnormal = unsignedJwt({
      iat: NOW_SEC + 120,
      exp: NOW_SEC + 3600,
    });
    expect(
      retryWaitMsForJwtIssuedAtFuture({
        status: 401,
        body: pgrst303Body(),
        accessToken: expired,
        nowSec: NOW_SEC,
      }),
    ).toBeNull();
    expect(
      retryWaitMsForJwtIssuedAtFuture({
        status: 401,
        body: pgrst303Body(),
        accessToken: abnormal,
        nowSec: NOW_SEC,
      }),
    ).toBeNull();
    expect(
      retryWaitMsForJwtIssuedAtFuture({
        status: 401,
        body: JSON.stringify({ code: "PGRST301", message: "JWT expired" }),
        accessToken: unsignedJwt({
          iat: NOW_SEC - 10,
          exp: NOW_SEC + 3600,
        }),
        nowSec: NOW_SEC,
      }),
    ).toBeNull();
  });
});

describe("isJwtIssuedAtFutureError", () => {
  it("recognizes PostgREST code and the thrown message", () => {
    expect(isJwtIssuedAtFutureError(pgrst303Body())).toBe(true);
    expect(isJwtIssuedAtFutureError("JWT issued at future")).toBe(true);
    expect(isJwtIssuedAtFutureError("JWT expired")).toBe(false);
  });
});

describe("fetchWithJwtIssuedAtRetry", () => {
  it("retries PGRST303 once for a valid session token and then returns success", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = unsignedJwt({
      iat: now - 2,
      exp: now + 3600,
    });
    const fetchMock = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(
        new Response(pgrst303Body(), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithJwtIssuedAtRetry(
      "http://127.0.0.1/rest/v1/profiles",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("waits past a one-second future iat before exactly one retry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_SEC * 1000));
    const token = unsignedJwt({
      iat: NOW_SEC + 1,
      exp: NOW_SEC + 3600,
    });
    const fetchMock = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(
        new Response(pgrst303Body(), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const pending = fetchWithJwtIssuedAtRetry(
      "http://127.0.0.1/rest/v1/profiles",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_049);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(Date.now()).toBeLessThan((NOW_SEC + 1) * 1000 + 50);

    await vi.advanceTimersByTimeAsync(1);
    expect(Date.now()).toBeGreaterThan((NOW_SEC + 1) * 1000);
    const response = await pending;
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry PGRST303 when the bearer token is missing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(pgrst303Body(), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithJwtIssuedAtRetry(
      "http://127.0.0.1/rest/v1/profiles",
    );
    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a 5s future iat that still sits ahead after max wait", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = unsignedJwt({
      iat: now + 5,
      exp: now + 3600,
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(pgrst303Body(), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithJwtIssuedAtRetry(
      "http://127.0.0.1/rest/v1/profiles",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry an expired token presented as JWT issued at future", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = unsignedJwt({
      iat: now - 4000,
      exp: now - 10,
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(pgrst303Body(), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithJwtIssuedAtRetry(
      "http://127.0.0.1/rest/v1/profiles",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reads the bearer token from a Request input", () => {
    const token = unsignedJwt({ iat: 1, exp: 2 });
    const request = new Request("http://127.0.0.1/rest/v1/profiles", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(accessTokenFromFetch(request)).toBe(token);
  });
});

describe("Analys JWT error path", () => {
  it("keeps loader.analys as the reporter and retries only on the server REST client", () => {
    const analys = readFileSync(
      new URL("../../features/finance/load-analys.ts", import.meta.url),
      "utf8",
    );
    const server = readFileSync(new URL("./server.ts", import.meta.url), "utf8");
    const auth = readFileSync(new URL("./auth-user.ts", import.meta.url), "utf8");
    expect(analys).toContain('reportError("loader.analys"');
    expect(analys).toContain("getCachedTodaySnapshot");
    expect(auth).toContain("auth.getSession()");
    expect(server).toContain("fetchWithJwtIssuedAtRetry");
    expect(server).not.toContain("autoRefreshToken: true");
  });
});
