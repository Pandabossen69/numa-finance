import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured } from "./config";
import { supabaseClientOptions } from "./options";

export function createSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    supabaseClientOptions,
  );
}

export { isSupabaseConfigured };
