import { cache } from "react";
import { withTimeoutRetry } from "@/lib/async";
import { isSupabaseConfigured } from "./config";
import { createSupabaseServerClient } from "./server";

export type AuthUser = { id: string; email: string };

/**
 * One Auth getUser() per request. Layout, onboarding, and snapshot
 * used to each call it — that serial RTT made the first Hem paint stall.
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await withTimeoutRetry(
    () => supabase.auth.getUser(),
    8_000,
    "getAuthUser",
    1,
  );
  if (error || !user) return null;
  return { id: user.id, email: user.email ?? "" };
});
