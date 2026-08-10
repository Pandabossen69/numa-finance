const LOCAL_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"];

export const LOCAL_ORIGIN = "http://localhost:3000";

export function normalizeOrigin(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
}

function firstValue(headerValue: string | null | undefined): string | null {
  const first = headerValue?.split(",")[0]?.trim();
  return first ? first : null;
}

export function originFromHeaders(
  get: (name: string) => string | null | undefined,
): string | null {
  const host = firstValue(get("x-forwarded-host")) ?? firstValue(get("host"));
  if (!host) return null;
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  const proto =
    firstValue(get("x-forwarded-proto")) ??
    (LOCAL_HOSTS.includes(hostname) ? "http" : "https");
  return normalizeOrigin(`${proto}://${host}`);
}
