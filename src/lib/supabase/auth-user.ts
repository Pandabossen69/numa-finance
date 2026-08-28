import { cache } from "react";
import { withTimeoutRetry } from "@/lib/async";
import { isSupabaseConfigured } from "./config";
import { createSupabaseServerClient } from "./server";

export type AuthUser = { id: string; email: string };

/**
 * One session read per request. Proxy already verified the JWT with
 * auth.getUser(); RSC uses the local cookie session so Hem/Plan/Analys
 * do not pay a second Auth round-trip on every tab switch.
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await withTimeoutRetry(
    () => supabase.auth.getSession(),
    2_000,
    "getAuthUser",
    0,
  );
  const user = session?.user;
  if (!user) return null;
  return { id: user.id, email: user.email ?? "" };
});
