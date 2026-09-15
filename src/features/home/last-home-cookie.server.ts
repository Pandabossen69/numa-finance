import { cookies } from "next/headers";
import type { HomeSnapshot } from "@/features/finance/load-home";
import { loadHomeSnapshot } from "@/features/finance/load-home";
import { getSessionUser } from "@/features/auth/session";
import {
  LAST_HOME_COOKIE,
  lastHomeCookieForSession,
  parseLastHomeCookie,
  toLastHomeCookieShell,
} from "@/features/home/last-home-cookie";

/**
 * First HTML for /idag — last-known numbers only when the cookie is bound
 * to the current session user. Mismatch / no session → no financial shell.
 * Uses getSessionUser (request-cached getSession), not a second Auth getUser.
 */
export async function readLastHomeCookie(): Promise<HomeSnapshot | null> {
  const [jar, user] = await Promise.all([cookies(), getSessionUser()]);
  return lastHomeCookieForSession(
    jar.get(LAST_HOME_COOKIE)?.value,
    user?.id,
  );
}

/**
 * Visible keep-alive Hem shell (SPEC 6d).
 * Warm: session-bound `numa.lastHome.v1` — no money fetch.
 * Cold (authenticated, no cookie): live `loadHomeSnapshot` so first HTML
 * paints Kvar/Över instead of HemPending until the client action returns.
 * Fail-closed on user mismatch; slim shell matches cookie shape.
 */
export async function resolveHomeShell(): Promise<HomeSnapshot | null> {
  const [jar, user] = await Promise.all([cookies(), getSessionUser()]);
  const fromCookie = lastHomeCookieForSession(
    jar.get(LAST_HOME_COOKIE)?.value,
    user?.id,
  );
  if (fromCookie) return fromCookie;
  if (!user?.id) return null;

  const result = await loadHomeSnapshot();
  if (!result.ok) return null;
  if (result.data.userId !== user.id) return null;
  return toLastHomeCookieShell(result.data);
}

export async function clearLastHomeCookie(): Promise<void> {
  try {
    const jar = await cookies();
    jar.delete(LAST_HOME_COOKIE);
  } catch {
    // Server Components cannot always mutate cookies.
  }
}

/** Drop a leftover Hem cookie when login belongs to another account. */
export async function discardLastHomeCookieIfNotUser(
  userId: string,
): Promise<void> {
  try {
    const jar = await cookies();
    const snap = parseLastHomeCookie(jar.get(LAST_HOME_COOKIE)?.value);
    if (!snap || snap.userId === userId) return;
    jar.delete(LAST_HOME_COOKIE);
  } catch {
    // Same as clear — ignore when headers are read-only.
  }
}
