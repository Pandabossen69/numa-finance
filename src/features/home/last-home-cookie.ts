import type { HomeSnapshot } from "@/features/finance/load-home";

export const LAST_HOME_COOKIE = "numa.lastHome.v1";
const MAX_COOKIE_CHARS = 3_500;

export function parseLastHomeCookie(
  raw: string | undefined | null,
): HomeSnapshot | null {
  if (!raw) return null;
  try {
    const decoded = raw.includes("%") ? decodeURIComponent(raw) : raw;
    const parsed: unknown = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const rec = parsed as Partial<HomeSnapshot>;
    if (typeof rec.userId !== "string" || rec.userId.length === 0) return null;
    if (typeof rec.currency !== "string") return null;
    if (typeof rec.remainingTodayMinor !== "number") return null;
    if (typeof rec.dayBudgetMinor !== "number") return null;
    return rec as HomeSnapshot;
  } catch {
    return null;
  }
}

export function serializeLastHomeCookie(home: HomeSnapshot): string | null {
  try {
    const encoded = encodeURIComponent(JSON.stringify(home));
    if (encoded.length > MAX_COOKIE_CHARS) return null;
    return encoded;
  } catch {
    return null;
  }
}

export function readLastHomeCookieFromDocument(): HomeSnapshot | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split("; ");
  const prefix = `${LAST_HOME_COOKIE}=`;
  const hit = parts.find((part) => part.startsWith(prefix));
  return parseLastHomeCookie(hit ? hit.slice(prefix.length) : null);
}

export function writeLastHomeCookie(home: HomeSnapshot | null): void {
  if (typeof document === "undefined") return;
  if (!home) {
    document.cookie = `${LAST_HOME_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    return;
  }
  const encoded = serializeLastHomeCookie(home);
  if (!encoded) return;
  document.cookie = `${LAST_HOME_COOKIE}=${encoded}; Path=/; Max-Age=2592000; SameSite=Lax`;
}
