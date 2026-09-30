import { cookies } from "next/headers";
import type { HomeSnapshot } from "@/features/finance/load-home";
import { getSessionUser } from "@/features/auth/session";
import {
  LAST_HOME_COOKIE,
  lastHomeCookieForSession,
  parseLastHomeCookie,
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
 * Explicit delete only. Logout must keep the slim shell so same-user
 * cold login can SSR Kvar/Över (SPEC B). Other-account login still
 * goes through discardLastHomeCookieIfNotUser.
 */
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
