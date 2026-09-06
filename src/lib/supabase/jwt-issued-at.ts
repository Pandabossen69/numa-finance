/**
 * PostgREST PGRST303 ("JWT issued at future") hits Analys when
 * loadAnalysSnapshot → getCachedTodaySnapshot → numa REST reads
 * the session access token. Proxy already called auth.getUser()
 * against Auth (issuer clock); RSC uses getSession() and then
 * PostgREST checks iat.
 *
 * Causes we handle, without loosening exp:
 * - Small iat skew (NTP / issuer slightly ahead): one short wait + retry.
 * - Valid iat + PGRST303: PostgREST first-request clock-cache bug;
 *   the same token succeeds on the next request.
 *
 * Abnormal future iat, millisecond claims, and expired tokens stay
 * fail-closed. This module never treats an unverified JWT as proof
 * of identity — it only decides whether one identical retry is safe.
 */

export const JWT_IAT_SKEW_SECONDS = 30;
const MAX_IAT_WAIT_MS = 2_000;
const MS_CLAIM_THRESHOLD = 1e12;
const MAX_PAYLOAD_CHARS = 8_192;

export type JwtTimeVerdict =
  | "valid"
  | "retryable_future_iat"
  | "abnormal_future_iat"
  | "expired"
  | "invalid";

export function decodeJwtPayload(
  token: string,
): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    if (!json || json.length > MAX_PAYLOAD_CHARS) return null;
    const payload: unknown = JSON.parse(json);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return null;
    }
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

function numericClaim(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

export function classifyJwtTime(
  token: string,
  nowSec = Math.floor(Date.now() / 1000),
): JwtTimeVerdict {
  const payload = decodeJwtPayload(token);
  if (!payload) return "invalid";

  const exp = numericClaim(payload.exp);
  const iat = numericClaim(payload.iat);
  if (exp == null) return "invalid";
  if (exp >= MS_CLAIM_THRESHOLD || (iat != null && iat >= MS_CLAIM_THRESHOLD)) {
    return "invalid";
  }
  if (exp <= nowSec) return "expired";
  if (iat == null) return "valid";
  if (iat <= nowSec) return "valid";
  if (iat - nowSec <= JWT_IAT_SKEW_SECONDS) return "retryable_future_iat";
  return "abnormal_future_iat";
}

export function isJwtIssuedAtFutureError(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return false;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const rec = parsed as Record<string, unknown>;
      if (rec.code === "PGRST303") return true;
      if (
        typeof rec.message === "string" &&
        rec.message.includes("JWT issued at future")
      ) {
        return true;
      }
    }
  } catch {
    // Fall through to the raw-text check used when the repo rethrows
    // `new Error(error.message)` from PostgREST.
  }
  return trimmed.includes("JWT issued at future");
}

function bearerFromHeaders(headers?: HeadersInit): string | null {
  if (!headers) return null;
  let value: string | null = null;
  if (headers instanceof Headers) {
    value = headers.get("Authorization") ?? headers.get("authorization");
  } else if (Array.isArray(headers)) {
    const hit = headers.find(([key]) => key.toLowerCase() === "authorization");
    value = hit?.[1] ?? null;
  } else {
    const rec = headers as Record<string, string>;
    value = rec.Authorization ?? rec.authorization ?? null;
  }
  if (!value) return null;
  const match = /^Bearer\s+(\S+)/i.exec(value.trim());
  return match?.[1] ?? null;
}

export function accessTokenFromFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): string | null {
  const fromInit = bearerFromHeaders(init?.headers);
  if (fromInit) return fromInit;
  if (typeof Request !== "undefined" && input instanceof Request) {
    return bearerFromHeaders(input.headers);
  }
  return null;
}

export function retryWaitMsForJwtIssuedAtFuture(params: {
  status: number;
  body: string;
  accessToken: string | null;
  nowSec?: number;
}): number | null {
  if (params.status !== 401) return null;
  if (!isJwtIssuedAtFutureError(params.body)) return null;

  const token = params.accessToken;
  if (!token) return 0;

  const nowSec = params.nowSec ?? Math.floor(Date.now() / 1000);
  const verdict = classifyJwtTime(token, nowSec);
  if (
    verdict === "expired" ||
    verdict === "abnormal_future_iat" ||
    verdict === "invalid"
  ) {
    return null;
  }
  if (verdict === "retryable_future_iat") {
    const iat = numericClaim(decodeJwtPayload(token)?.iat);
    const skewSec = iat == null ? 0 : Math.max(iat - nowSec, 0);
    return Math.min(skewSec * 1000 + 50, MAX_IAT_WAIT_MS);
  }
  return 0;
}

export async function fetchWithJwtIssuedAtRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, init);
  let body: string;
  try {
    body = await response.clone().text();
  } catch {
    return response;
  }
  const waitMs = retryWaitMsForJwtIssuedAtFuture({
    status: response.status,
    body,
    accessToken: accessTokenFromFetch(input, init),
  });
  if (waitMs == null) return response;
  if (waitMs > 0) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, waitMs);
    });
  }
  return fetch(input, init);
}
