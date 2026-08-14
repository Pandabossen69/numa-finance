"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

const authSchema = z.object({
  email: z.string().email("Ogiltig e-postadress"),
  password: z.string().min(8, "Lösenordet måste vara minst 8 tecken"),
});

export type AuthResult =
  | { ok: true }
  | { ok: false; error: string };

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
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte logga in",
    };
  }
}

export async function signUpAction(raw: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  try {
    const input = authSchema.parse(raw);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { display_name: "Användare", app: "numa" },
      },
    });
    if (error) {
      return { ok: false, error: swedishAuthError(error.message) };
    }
    if (!data.session) {
      return {
        ok: false,
        error:
          "Kontot skapades, men e-postbekräftelse är fortfarande på. Bekräfta mailet, eller stäng av “Confirm email” under Authentication → Providers → Email i Supabase. Därefter kan du logga in.",
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte skapa konto",
    };
  }
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
  redirect("/logga-in");
}

function swedishAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login")) return "Fel e-post eller lösenord";
  if (lower.includes("already registered")) return "E-postadressen finns redan";
  if (lower.includes("email not confirmed")) {
    return "E-postadressen är inte bekräftad ännu";
  }
  return message;
}
