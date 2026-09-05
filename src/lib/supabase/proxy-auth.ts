/** Cookie-only Auth hints for the proxy. Never stores user or money data. */

const FRESH_SKEW_MS = 30_000;

export function isRscOrPrefetchRequest(headers: {
  get(name: string): string | null;
}): boolean {
  const rsc = headers.get("RSC") ?? headers.get("rsc");
  const prefetch =
    headers.get("Next-Router-Prefetch") ?? headers.get("next-router-prefetch");
  return rsc === "1" || prefetch === "1";
}

/**
 * Skip the Auth network on RSC / prefetch when a cookie is already present
 * and the access token is not clearly expired. Document requests still
 * call getUser() so refresh cookies stay current.
 */
export function shouldSkipProxyGetUser(input: {
  hasAuthCookie: boolean;
  isRscOrPrefetch: boolean;
  tokenExpiresAtMs: number | null;
  nowMs: number;
}): boolean {
  if (!input.hasAuthCookie || !input.isRscOrPrefetch) return false;
  if (input.tokenExpiresAtMs == null) return true;
  return input.tokenExpiresAtMs - input.nowMs > FRESH_SKEW_MS;
}

export function readAccessTokenExpiryMs(
  cookies: readonly { name: string; value: string }[],
): number | null {
  const raw = combineAuthCookieValue(cookies);
  if (!raw) return null;
  const session = parseSessionJson(raw);
  if (!session) return null;
  if (typeof session.expires_at === "number" && Number.isFinite(session.expires_at)) {
    return session.expires_at > 1e12
      ? session.expires_at
      : session.expires_at * 1000;
  }
  if (typeof session.access_token === "string") {
    return jwtExpiryMs(session.access_token);
  }
  return null;
}

function combineAuthCookieValue(
  cookies: readonly { name: string; value: string }[],
): string | null {
  const auth = cookies.filter(
    (cookie) =>
      (cookie.name.includes("auth-token") || cookie.name.startsWith("sb-")) &&
      cookie.value.length > 0 &&
      !cookie.name.includes("code-verifier"),
  );
  const tokenCookies = auth.filter((cookie) => cookie.name.includes("auth-token"));
  const rows = tokenCookies.length > 0 ? tokenCookies : auth;
  if (rows.length === 0) return null;
  return rows
    .map((cookie) => {
      const chunk = cookie.name.match(/\.(\d+)$/);
      return { index: chunk ? Number(chunk[1]) : -1, value: cookie.value };
    })
    .sort((a, b) => a.index - b.index)
    .map((row) => row.value)
    .join("");
}

function parseSessionJson(
  raw: string,
): { expires_at?: number; access_token?: string } | null {
  const candidates = [raw];
  try {
    candidates.push(decodeURIComponent(raw));
  } catch {
    // Cookie was not URI-encoded.
  }
  if (raw.startsWith("base64-")) {
    const encoded = raw.slice("base64-".length);
    for (const encoding of ["base64url", "base64"] as const) {
      try {
        candidates.push(Buffer.from(encoded, encoding).toString("utf8"));
      } catch {
        // Try the next encoding.
      }
    }
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as {
        expires_at?: number;
        access_token?: string;
      };
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // Not JSON.
    }
  }
  return null;
}

function jwtExpiryMs(token: string): number | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (normalized.length % 4)) % 4);
    const json = Buffer.from(normalized + pad, "base64").toString("utf8");
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
      return null;
    }
    return payload.exp * 1000;
  } catch {
    return null;
  }
}
