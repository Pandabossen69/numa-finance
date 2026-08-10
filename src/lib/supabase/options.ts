import type { SupabaseClient } from "@supabase/supabase-js";

export const NUMA_SCHEMA = "numa";

/** Browser / SPA client — may persist + refresh session. */
export const supabaseBrowserOptions = {
  db: { schema: NUMA_SCHEMA },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
} as const;

/**
 * Server / proxy client — never persist or auto-refresh in RSC.
 * Sharing browser auth flags here caused hung getUser() calls and blank pages.
 */
export const supabaseServerOptions = {
  db: { schema: NUMA_SCHEMA },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
} as const;

/** @deprecated Use supabaseBrowserOptions or supabaseServerOptions. */
export const supabaseClientOptions = supabaseBrowserOptions;

export type NumaSupabaseClient = SupabaseClient;
