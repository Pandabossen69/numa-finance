import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import {
  HOME_PATH,
  LOGIN_PATH,
  PASSWORD_RESET_REQUEST_PATH,
  PASSWORD_UPDATE_PATH,
} from "@/features/auth/routes";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = [
  "recovery",
  "signup",
  "invite",
  "magiclink",
  "email",
  "email_change",
];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = parseOtpType(searchParams.get("type"));
  const isRecovery = type === "recovery";

  const success = new URL(
    isRecovery ? PASSWORD_UPDATE_PATH : nextPath(searchParams.get("next")),
    origin,
  );
  const failure = new URL(
    isRecovery ? PASSWORD_RESET_REQUEST_PATH : LOGIN_PATH,
    origin,
  );
  failure.searchParams.set("fel", "lank");

  if (searchParams.get("error") || searchParams.get("error_description")) {
    return NextResponse.redirect(failure);
  }
  if (!isSupabaseConfigured()) {
    failure.searchParams.set("fel", "konfiguration");
    return NextResponse.redirect(failure);
  }

  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(failure);
    return NextResponse.redirect(success);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) return NextResponse.redirect(failure);
    return NextResponse.redirect(success);
  }

  // No code in the query: the link may carry tokens in the URL fragment,
  // which only the browser can read. Let the client page finish the flow.
  return NextResponse.redirect(success);
}

function parseOtpType(value: string | null): EmailOtpType | null {
  return OTP_TYPES.find((type) => type === value) ?? null;
}

function nextPath(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return HOME_PATH;
}
