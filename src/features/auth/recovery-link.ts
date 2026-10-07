export type RecoveryLink =
  | { kind: "error" }
  | { kind: "code"; code: string }
  | { kind: "otp"; tokenHash: string }
  | { kind: "hash-session" }
  | { kind: "none" };

export type NewPasswordEntry =
  | { type: "exchange"; href: string }
  | { type: "invalid" }
  | { type: "rate-limit" }
  | { type: "check-session" };

function paramsFrom(search: string): URLSearchParams {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(raw);
}

function hashParamsFrom(hash: string): URLSearchParams {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  return new URLSearchParams(raw);
}

/**
 * Recovery landing. `code` is the PKCE exchange. `token_hash` is the
 * cross-device OTP. Error params (including our own `fel`) never exchange.
 */
export function recoveryLinkFromLocation(search: string, hash = ""): RecoveryLink {
  const params = paramsFrom(search);
  const hashParams = hashParamsFrom(hash);
  const error = params.get("error") || params.get("fel") || hashParams.get("error");
  const errorCode = params.get("error_code") || hashParams.get("error_code");
  if (error || errorCode) return { kind: "error" };

  const code = params.get("code")?.trim();
  if (code) return { kind: "code", code };

  const tokenHash = (params.get("token_hash") || params.get("token"))?.trim();
  const type = (params.get("type") || hashParams.get("type"))?.trim();
  if (tokenHash) {
    if (type && type !== "recovery") return { kind: "error" };
    return { kind: "otp", tokenHash };
  }

  const accessToken = hashParams.get("access_token")?.trim();
  if (accessToken && (!type || type === "recovery")) {
    return { kind: "hash-session" };
  }
  return { kind: "none" };
}

export function recoveryCallbackHref(
  link: Extract<RecoveryLink, { kind: "code" | "otp" }>,
): string {
  const params = new URLSearchParams();
  if (link.kind === "code") {
    params.set("code", link.code);
  } else {
    params.set("token_hash", link.tokenHash);
    params.set("type", "recovery");
  }
  return `/auth/callback?${params.toString()}`;
}

export function searchParamsToURLSearchParams(
  raw: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value) && value[0]) params.set(key, value[0]);
  }
  return params;
}

export function newPasswordEntry(params: URLSearchParams): NewPasswordEntry {
  if (params.get("fel") === "grans") return { type: "rate-limit" };
  const link = recoveryLinkFromLocation(params.toString());
  if (link.kind === "error") return { type: "invalid" };
  if (link.kind === "code" || link.kind === "otp") {
    return { type: "exchange", href: recoveryCallbackHref(link) };
  }
  return { type: "check-session" };
}
