import type { SupabaseClient } from "@supabase/supabase-js";

export const NUMA_SCHEMA = "numa";

export const supabaseClientOptions = {
  db: { schema: NUMA_SCHEMA },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
} as const;

export type NumaSupabaseClient = SupabaseClient;
