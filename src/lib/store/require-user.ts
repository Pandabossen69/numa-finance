import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withTimeout } from "@/lib/store/with-timeout";

const AUTH_TIMEOUT_MS = 5_000;

/** One auth lookup per request — avoids N× getUser() round-trips. */
export const requireUserId = cache(async (): Promise<string> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await withTimeout(
    supabase.auth.getUser(),
    AUTH_TIMEOUT_MS,
    "auth.getUser",
  );
  if (error || !user) {
    throw new Error("Du måste vara inloggad");
  }
  return user.id;
});
