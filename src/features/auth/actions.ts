"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PREVIEW_COOKIE, withPreviewQuery } from "@/lib/site";
import { z } from "zod";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { loadOnboardingState } from "@/features/onboarding/load";
import {
  clearOnboardingCookie,
  persistOnboardingPhaseCookie,
} from "@/features/onboarding/persist-cookie";
import type { AuthResult } from "./result";
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
    const { error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (error) {
      return { ok: false, error: swedishAuthError(error.message) };
    }
    const state = await loadOnboardingState();
    await persistOnboardingPhaseCookie(state.phase);
    return { ok: true, nextPath: state.nextPath };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte logga in",
    };
  }
}

/** Public self-signup is closed. New accounts are created by the NUMA admin. */
export async function signUpAction(_raw?: {
  email: string;
  password: string;
}): Promise<AuthResult> {
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
