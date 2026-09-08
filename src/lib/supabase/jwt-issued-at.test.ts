import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  accessTokenFromFetch,
  classifyJwtTime,
  fetchWithJwtIssuedAtRetry,
  initWithFetchMemoizationBypass,
  isJwtIssuedAtFutureError,
  MAX_IAT_WAIT_MS,
  resetSharedJwtIssuedAtWait,
  retryWaitMsForJwtIssuedAtFuture,
  waitMsToPassFutureIat,
  waitSharedJwtIssuedAt,
} from "./jwt-issued-at";

const NOW_SEC = 1_788_674_400;

function unsignedJwt(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
    "base64url",
  );
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.sig`;
}

function pgrst303Body(): string {
  return JSON.stringify({
    code: "PGRST303",
    message: "JWT issued at future",
  });
}

/**
 * Same GET-dedupe rules as Next.js 16 `createDedupeFetch`:
 * signal / non-GET / keepalive opt out; `cache` is not in the key.
 * React.cache is a no-op in the client React build Vitest loads, so
 * the real helper cannot be used here.
 */
function createNextRequestDedupeFetch(
  originalFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  const headersToExclude = new Set(["traceparent", "tracestate"]);
  const simpleCacheKey = '["GET",[],null,"follow",null,null,null,null]';
  const byUrl = new Map<string, Array<[string, Promise<Response>, Response | null]>>();

  function generateCacheKey(request: Request): string {
    const filteredHeaders = Array.from(request.headers.entries()).filter(
      ([key]) => !headersToExclude.has(key.toLowerCase()),
    );
    return JSON.stringify([
      request.method,
      filteredHeaders,
      request.mode,
      request.redirect,
      request.credentials,
      request.referrer,
      request.referrerPolicy,
      request.integrity,
    ]);
  }

  return function dedupeFetch(resource, options) {
    if (options?.signal) {
      return originalFetch(resource, options);
    }

    let url: string;
    let cacheKey: string;
    if (typeof resource === "string" && !options) {
      cacheKey = simpleCacheKey;
      url = resource;
    } else {
      const request =
        typeof resource === "string" || resource instanceof URL
          ? new Request(resource, options)
          : resource;
      if ((request.method !== "GET" && request.method !== "HEAD") || request.keepalive) {
        return originalFetch(resource, options);
      }
      cacheKey = generateCacheKey(request);
      url = request.url;
    }

    let cacheEntries = byUrl.get(url);
    if (!cacheEntries) {
      cacheEntries = [];
      byUrl.set(url, cacheEntries);
    }
    for (let i = 0; i < cacheEntries.length; i += 1) {
      const [key, promise] = cacheEntries[i]!;
      if (key === cacheKey) {
        return promise.then(() => {
          const cached = cacheEntries[i]![2];
          if (!cached) throw new Error("No cached response");
          return cached.clone();
        });
      }
    }

    const promise = originalFetch(resource, options);
    const entry: [string, Promise<Response>, Response | null] = [cacheKey, promise, null];
    cacheEntries.push(entry);
    return promise.then((response) => {
      entry[2] = response.clone();
      return response;
    });
  };
}

function networkFetchMock(
  impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
) {
  return vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(impl);
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetSharedJwtIssuedAtWait();
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
    expect(retryWaitMsForJwtIssuedAtFuture({ ...base, accessToken: null })).toBeNull();
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

    const pending = fetchWithJwtIssuedAtRetry("http://127.0.0.1/rest/v1/profiles", {
      headers: { Authorization: `Bearer ${token}` },
    });
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

    const response = await fetchWithJwtIssuedAtRetry("http://127.0.0.1/rest/v1/profiles");
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

describe("Next.js request memoization vs JWT retry", () => {
  function validToken(): string {
    const now = Math.floor(Date.now() / 1000);
    return unsignedJwt({ iat: now - 2, exp: now + 3600 });
  }

  it("counts a real second PostgREST call when GET would otherwise be memoized", async () => {
    const token = validToken();
    const network = networkFetchMock(async () => {
      throw new Error("unexpected extra network call");
    });
    network
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
    vi.stubGlobal("fetch", createNextRequestDedupeFetch(network));

    const response = await fetchWithJwtIssuedAtRetry(
      "http://127.0.0.1/rest/v1/profiles",
      { headers: { Authorization: `Bearer ${token}` } },
    );

    expect(network).toHaveBeenCalledTimes(2);
    expect(network.mock.calls[1]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("would stay on the memoized 401 if the retry reused the same GET options", async () => {
    const token = validToken();
    const network = networkFetchMock(async () => {
      return new Response(pgrst303Body(), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    });
    const deduped = createNextRequestDedupeFetch(network);
    const url = "http://127.0.0.1/rest/v1/profiles";
    const init = { headers: { Authorization: `Bearer ${token}` } };

    const first = await deduped(url, init);
    const sameOptions = await deduped(url, init);
    const noStore = await deduped(url, { ...init, cache: "no-store" });

    expect(first.status).toBe(401);
    expect(sameOptions.status).toBe(401);
    expect(noStore.status).toBe(401);
    expect(network).toHaveBeenCalledTimes(1);

    const bypassed = await deduped(url, initWithFetchMemoizationBypass(init));
    expect(bypassed.status).toBe(401);
    expect(network).toHaveBeenCalledTimes(2);
  });

  it("does not treat cache: no-store as a memoization opt-out", () => {
    const withNoStore = { cache: "no-store" as RequestCache };
    const bypassed = initWithFetchMemoizationBypass(withNoStore);
    expect(bypassed.cache).toBe("no-store");
    expect(bypassed.signal).toBeInstanceOf(AbortSignal);
  });

  it("keeps an existing caller signal instead of replacing it", () => {
    const signal = new AbortController().signal;
    expect(initWithFetchMemoizationBypass({ signal }).signal).toBe(signal);
  });

  it("returns a normal success without a second network call", async () => {
    const token = validToken();
    const network = networkFetchMock(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", createNextRequestDedupeFetch(network));

    const response = await fetchWithJwtIssuedAtRetry(
      "http://127.0.0.1/rest/v1/profiles",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(response.status).toBe(200);
    expect(network).toHaveBeenCalledTimes(1);
  });

  it("waits past a one-second future iat, then makes exactly one new network call", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_SEC * 1000));
    const token = unsignedJwt({
      iat: NOW_SEC + 1,
      exp: NOW_SEC + 3600,
    });
    const network = networkFetchMock(async () => {
      throw new Error("unexpected extra network call");
    });
    network
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
    vi.stubGlobal("fetch", createNextRequestDedupeFetch(network));

    const pending = fetchWithJwtIssuedAtRetry("http://127.0.0.1/rest/v1/profiles", {
      headers: { Authorization: `Bearer ${token}` },
    });
    await Promise.resolve();
    expect(network).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_049);
    expect(network).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(Date.now()).toBeGreaterThan((NOW_SEC + 1) * 1000);

    const response = await pending;
    expect(response.status).toBe(200);
    expect(network).toHaveBeenCalledTimes(2);
    expect(network.mock.calls[1]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("shares one iat wait across parallel PostgREST reads", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_SEC * 1000));
    const first = waitSharedJwtIssuedAt(1_050);
    const second = waitSharedJwtIssuedAt(1_050);
    await vi.advanceTimersByTimeAsync(1_049);
    let settled = false;
    void Promise.all([first, second]).then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await Promise.all([first, second]);
    expect(settled).toBe(true);
  });

  it("does not retry a 5s future iat under memoized GET", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = unsignedJwt({ iat: now + 5, exp: now + 3600 });
    const network = networkFetchMock(async () => {
      return new Response(pgrst303Body(), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", createNextRequestDedupeFetch(network));

    const response = await fetchWithJwtIssuedAtRetry(
      "http://127.0.0.1/rest/v1/profiles",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(response.status).toBe(401);
    expect(network).toHaveBeenCalledTimes(1);
  });

  it("does not retry a missing bearer under memoized GET", async () => {
    const network = networkFetchMock(async () => {
      return new Response(pgrst303Body(), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", createNextRequestDedupeFetch(network));

    const response = await fetchWithJwtIssuedAtRetry("http://127.0.0.1/rest/v1/profiles");
    expect(response.status).toBe(401);
    expect(network).toHaveBeenCalledTimes(1);
  });

  it("does not retry an expired token under memoized GET", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = unsignedJwt({ iat: now - 4000, exp: now - 10 });
    const network = networkFetchMock(async () => {
      return new Response(pgrst303Body(), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", createNextRequestDedupeFetch(network));

    const response = await fetchWithJwtIssuedAtRetry(
      "http://127.0.0.1/rest/v1/profiles",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(response.status).toBe(401);
    expect(network).toHaveBeenCalledTimes(1);
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
    const home = readFileSync(
      new URL("../../features/finance/load-home.ts", import.meta.url),
      "utf8",
    );
    const plan = readFileSync(
      new URL("../../features/finance/load-plan.ts", import.meta.url),
      "utf8",
    );
    expect(home).toContain("getCachedTodaySnapshot");
    expect(plan).toContain("getCachedTodaySnapshot");
    expect(
      readFileSync(new URL("./jwt-issued-at.ts", import.meta.url), "utf8"),
    ).toContain("initWithFetchMemoizationBypass");
    expect(
      readFileSync(new URL("./jwt-issued-at.ts", import.meta.url), "utf8"),
    ).toContain("waitSharedJwtIssuedAt");
  });
});
