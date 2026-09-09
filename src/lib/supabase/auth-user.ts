import { cache } from "react";
import { withTimeoutRetry } from "@/lib/async";
import { isSupabaseConfigured } from "./config";
import { createSupabaseServerClient } from "./server";

export type AuthUser = {
  id: string;
  email: string;
  metadataDisplayName: string | null;
};

function metadataDisplayNameOf(user: {
  user_metadata?: unknown;
}): string | null {
  const meta = user.user_metadata;
  if (!meta || typeof meta !== "object") return null;
  const raw = (meta as Record<string, unknown>).display_name;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

/**
 * One cookie-session read per request for ordinary RSC/RLS work.
 * `session.user` is not a verified server identity — do not use it for
 * admin decisions or service-role. See `verified-identity.ts`.
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
  return {
    id: user.id,
    email: user.email ?? "",
    metadataDisplayName: metadataDisplayNameOf(user),
  };
});
