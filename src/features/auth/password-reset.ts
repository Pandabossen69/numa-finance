import { PRODUCTION_ORIGIN } from "@/lib/site";

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RESET_NEUTRAL_MESSAGE =
  "Om adressen finns skickar vi en länk inom några minuter.";

export const PASSWORD_RESET_RATE_LIMIT_MESSAGE =
  "För många försök. Vänta en stund och prova igen.";

export const PASSWORD_RESET_FAILED_MESSAGE = "Kunde inte skicka länken. Försök igen.";

export const PASSWORD_RESET_INVALID_EMAIL = "Ogiltig e-postadress";

export const PASSWORD_TOO_SHORT = "Lösenordet måste vara minst 8 tecken";

export const PASSWORD_MISMATCH = "Lösenorden matchar inte.";

export const RECOVERY_LINK_INVALID_MESSAGE = "Länken är ogiltig eller har gått ut.";

export const PASSWORD_UPDATE_FAILED_MESSAGE = "Kunde inte spara lösenordet. Försök igen.";

export const INVITE_ONLY_TITLE = "NUMA är just nu bara för inbjudna.";

export const LOGIN_INVITE_NOTE =
  "Har du ingen inbjudan? NUMA är just nu bara för inbjudna.";

const HOST_RE = /^[a-z0-9.-]+(?::\d+)?$/;

export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return PASSWORD_TOO_SHORT;
  if (password !== confirm) return PASSWORD_MISMATCH;
  return null;
}

export function isAuthRateLimitMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("rate limit") ||
    lower.includes("too many") ||
    lower.includes("only request this") ||
    lower.includes("security purposes") ||
    lower.includes("over_email_send_rate_limit") ||
    lower.includes("over_request_rate_limit")
  );
}

/** Hide whether the address exists. Rate limit and real failures stay visible. */
export function classifyPasswordResetError(
  message: string,
): "neutral" | "rate-limit" | "invalid-email" | "failed" {
  const lower = message.toLowerCase();
  if (isAuthRateLimitMessage(message)) return "rate-limit";
  if (
    lower.includes("user not found") ||
    lower.includes("user does not exist") ||
    lower.includes("email not found") ||
    lower.includes("no user") ||
    lower.includes("signups not allowed") ||
    lower.includes("signup is disabled")
  ) {
    return "neutral";
  }
  if (
    (lower.includes("invalid") && lower.includes("email")) ||
    lower.includes("unable to validate email")
  ) {
    return "invalid-email";
  }
  return "failed";
}

export function passwordResetUserMessage(
  kind: ReturnType<typeof classifyPasswordResetError>,
): { ok: true; message: string } | { ok: false; error: string } {
  if (kind === "neutral") {
    return { ok: true, message: PASSWORD_RESET_NEUTRAL_MESSAGE };
  }
  if (kind === "rate-limit") {
    return { ok: false, error: PASSWORD_RESET_RATE_LIMIT_MESSAGE };
  }
  if (kind === "invalid-email") {
    return { ok: false, error: PASSWORD_RESET_INVALID_EMAIL };
  }
  return { ok: false, error: PASSWORD_RESET_FAILED_MESSAGE };
}

export function swedishPasswordUpdateError(message: string): string {
  const lower = message.toLowerCase();
  if (isAuthRateLimitMessage(message)) return PASSWORD_RESET_RATE_LIMIT_MESSAGE;
  if (
    lower.includes("should be different") ||
    lower.includes("same password") ||
    lower.includes("different from the old")
  ) {
    return "Välj ett annat lösenord än det nuvarande.";
  }
  if (
    lower.includes("session") ||
    lower.includes("expired") ||
    lower.includes("invalid") ||
    lower.includes("jwt")
  ) {
    return RECOVERY_LINK_INVALID_MESSAGE;
  }
  if (lower.includes("at least") || lower.includes("password")) {
    return PASSWORD_TOO_SHORT;
  }
  return PASSWORD_UPDATE_FAILED_MESSAGE;
}

export function recoveryFailureParam(message: string): "grans" | "ogiltig" {
  return isAuthRateLimitMessage(message) ? "grans" : "ogiltig";
}

function firstHeaderValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim().toLowerCase() ?? "";
  return first || null;
}

function usableHost(value: string | null | undefined): string | null {
  const host = firstHeaderValue(value);
  if (!host || !HOST_RE.test(host)) return null;
  return host;
}

function protoFor(value: string | null | undefined, host: string): "http" | "https" {
  const proto = firstHeaderValue(value);
  if (proto === "http" || proto === "https") return proto;
  const name = host.split(":")[0] ?? "";
  if (name === "localhost" || name === "127.0.0.1") return "http";
  return "https";
}

function originFromAppUrl(appUrl: string | null | undefined): string | null {
  const trimmed = appUrl?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Preview and production must send the reset link back to the host that
 * asked. NEXT_PUBLIC_APP_URL is only the fallback when the request has no host.
 */
export function publicSiteOrigin(input: {
  forwardedHost?: string | null;
  forwardedProto?: string | null;
  host?: string | null;
  appUrl?: string | null;
}): string {
  const host = usableHost(input.forwardedHost) ?? usableHost(input.host);
  if (host) {
    return `${protoFor(input.forwardedProto, host)}://${host}`;
  }
  return originFromAppUrl(input.appUrl) ?? PRODUCTION_ORIGIN;
}

export function passwordResetRedirectTo(origin: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/nytt-losenord`;
}
