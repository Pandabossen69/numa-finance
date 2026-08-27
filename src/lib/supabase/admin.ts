import "server-only";

import { createClient } from "@supabase/supabase-js";
import { NUMA_SCHEMA } from "./options";

export function isServiceRoleConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/**
 * Service-role client for admin Auth APIs.
 * Never attach cookies — that would risk swapping the signed-in session.
 * Never import this from a Client Component.
 */
export function createSupabaseServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    db: { schema: NUMA_SCHEMA },
  });
}
