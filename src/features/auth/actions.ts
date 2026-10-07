"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { PREVIEW_COOKIE, withPreviewQuery } from "@/lib/site";
import { z } from "zod";
import { isPlausibleEmail } from "@/domain/identity/email";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  clearLastHomeCookie,
  discardLastHomeCookieIfNotUser,
} from "@/features/home/last-home-cookie.server";
import { loadOnboardingState } from "@/features/onboarding/load";
import {
  clearOnboardingCookie,
  persistOnboardingPhaseCookie,
} from "@/features/onboarding/persist-cookie";
import type { AuthResult } from "./result";
import {
  PASSWORD_RESET_FAILED_MESSAGE,
  PASSWORD_RESET_INVALID_EMAIL,
  PASSWORD_RESET_NEUTRAL_MESSAGE,
  PASSWORD_UPDATE_FAILED_MESSAGE,
  RECOVERY_LINK_INVALID_MESSAGE,
  classifyPasswordResetError,
  passwordResetRedirectTo,
  passwordResetUserMessage,
  publicSiteOrigin,
  swedishPasswordUpdateError,
  validateNewPassword,
} from "./password-reset";
import { rejectPublicSignup } from "./signup-policy";

export type { AuthResult };

const authSchema = z.object({
  email: z.string().email("Ogiltig e-postadress"),
  password: z.string().min(8, "Lösenordet måste vara minst 8 tecken"),
});

export async function signInAction(raw: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  try {
    const input = authSchema.parse(raw);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (error) {
      return { ok: false, error: swedishAuthError(error.message) };
    }
    const userId = data.user?.id;
    if (!userId) {
      return { ok: false, error: "Kunde inte logga in" };
    }
    return finishSignedIn(userId);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte logga in",
    };
  }
}

async function finishSignedIn(userId: string): Promise<AuthResult> {
  await discardLastHomeCookieIfNotUser(userId);
  const state = await loadOnboardingState();
  await persistOnboardingPhaseCookie(state.phase);
  return { ok: true, nextPath: state.nextPath, userId };
}

async function requestOrigin(): Promise<string> {
  const h = await headers();
  return publicSiteOrigin({
    forwardedHost: h.get("x-forwarded-host"),
    forwardedProto: h.get("x-forwarded-proto"),
    host: h.get("host"),
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  });
}

/**
 * Always the same success copy when the address might exist.
 * Rate limit and transport failures stay Swedish and specific.
 */
export async function requestPasswordResetAction(
  email: string,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const trimmed = email.trim();
  if (!isPlausibleEmail(trimmed)) {
    return { ok: false, error: PASSWORD_RESET_INVALID_EMAIL };
  }
  if (!isSupabaseConfigured()) {
    return { ok: false, error: PASSWORD_RESET_FAILED_MESSAGE };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const redirectTo = passwordResetRedirectTo(await requestOrigin());
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo,
    });
    if (!error) {
      return { ok: true, message: PASSWORD_RESET_NEUTRAL_MESSAGE };
    }
    const code = "code" in error ? (error.code ?? null) : null;
    return passwordResetUserMessage(classifyPasswordResetError(error.message, code));
  } catch {
    return { ok: false, error: PASSWORD_RESET_FAILED_MESSAGE };
  }
}

/** Recovery session is already signed in. Set the password, then sign in to Hem. */
export async function completePasswordResetAction(raw: {
  password: string;
  confirm: string;
}): Promise<AuthResult> {
  const invalid = validateNewPassword(raw.password, raw.confirm);
  if (invalid) return { ok: false, error: invalid };
  if (!isSupabaseConfigured()) {
    return { ok: false, error: PASSWORD_UPDATE_FAILED_MESSAGE };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const email = userData.user?.email;
    const userId = userData.user?.id;
    if (userError || !email || !userId) {
      return { ok: false, error: RECOVERY_LINK_INVALID_MESSAGE };
    }
    const { error: updateError } = await supabase.auth.updateUser({
      password: raw.password,
    });
    if (updateError) {
      return { ok: false, error: swedishPasswordUpdateError(updateError.message) };
    }
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: raw.password,
    });
    if (signInError || !data.user?.id) {
      return {
        ok: false,
        error: signInError
          ? swedishAuthError(signInError.message)
          : "Kunde inte logga in",
      };
    }
    return finishSignedIn(data.user.id);
  } catch {
    return { ok: false, error: PASSWORD_UPDATE_FAILED_MESSAGE };
  }
}

/** Public self-signup is closed. New accounts are created by the NUMA admin. */
export async function signUpAction(_raw?: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  void _raw;
  return rejectPublicSignup();
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } catch (error) {
      console.error("[numa] signOut failed", error);
    }
  }
  await clearOnboardingCookie();
  await clearLastHomeCookie();
  const jar = await cookies();
  const preview = jar.get(PREVIEW_COOKIE)?.value === "1";
  redirect(preview ? withPreviewQuery("/logga-in") : "/logga-in");
}

function swedishAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login")) return "Fel e-post eller lösenord";
  if (lower.includes("already registered")) return "E-postadressen finns redan";
  if (lower.includes("email not confirmed")) {
    return "E-postadressen är inte bekräftad ännu";
  }
  if (lower.includes("signups not allowed") || lower.includes("signup is disabled")) {
    return "Nya konton skapas bara av NUMA. Logga in om du redan har konto.";
  }
  return message;
}
