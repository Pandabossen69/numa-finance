import { NextResponse } from "next/server";
import { recoveryFailureParam } from "@/features/auth/password-reset";
import {
  newPasswordEntry,
  recoveryLinkFromLocation,
} from "@/features/auth/recovery-link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(origin: string, fel: "grans" | "ogiltig") {
  return NextResponse.redirect(new URL(`/nytt-losenord?fel=${fel}`, origin));
}

/**
 * PKCE `code` and recovery `token_hash` land here from /nytt-losenord
 * (or directly, if a mail template points at this path). Cookies can be
 * written from a route handler; a Server Component cannot.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const entry = newPasswordEntry(url.searchParams);
  if (entry.type !== "exchange") return fail(url.origin, "ogiltig");

  const link = recoveryLinkFromLocation(url.searchParams.toString());
  try {
    const supabase = await createSupabaseServerClient();
    if (link.kind === "code") {
      const { error } = await supabase.auth.exchangeCodeForSession(link.code);
      if (error) return fail(url.origin, recoveryFailureParam(error.message));
    } else if (link.kind === "otp") {
      const { error } = await supabase.auth.verifyOtp({
        type: "recovery",
        token_hash: link.tokenHash,
      });
      if (error) return fail(url.origin, recoveryFailureParam(error.message));
    } else {
      return fail(url.origin, "ogiltig");
    }
  } catch {
    return fail(url.origin, "ogiltig");
  }

  return NextResponse.redirect(new URL("/nytt-losenord", url.origin));
}
