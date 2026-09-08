import { cookies } from "next/headers";
import type { HomeSnapshot } from "@/features/finance/load-home";
import {
  LAST_HOME_COOKIE,
  parseLastHomeCookie,
} from "@/features/home/last-home-cookie";

/** First HTML for /idag — last-known numbers, not empty skel cards. */
export async function readLastHomeCookie(): Promise<HomeSnapshot | null> {
  const jar = await cookies();
  return parseLastHomeCookie(jar.get(LAST_HOME_COOKIE)?.value);
}
