import type { SupabaseClient } from "@supabase/supabase-js";

export const NUMA_SCHEMA = "numa";

export const supabaseBrowserOptions = {
  db: { schema: NUMA_SCHEMA },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
} as const;

/** Server must NOT auto-refresh — that hung getUser() and blanked pages. */
export const supabaseServerOptions = {
  db: { schema: NUMA_SCHEMA },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
} as const;

export const supabaseClientOptions = supabaseBrowserOptions;

export type NumaSupabaseClient = SupabaseClient;
