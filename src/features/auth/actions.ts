"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSiteOrigin } from "@/lib/site-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AUTH_COPY, swedishAuthError } from "./messages";
import { AUTH_CALLBACK_PATH, LOGIN_PATH } from "./routes";

const emailSchema = z.string().email(AUTH_COPY.invalidEmail);
const passwordSchema = z.string().min(8, AUTH_COPY.shortPassword);

const authSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type AuthResult =
  | { ok: true; status: "signed-in" }
  | { ok: true; status: "check-email"; message: string }
  | { ok: false; error: string };

export async function signInAction(raw: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const parsed = authSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error, AUTH_COPY.signInFailed) };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) {
      return { ok: false, error: swedishAuthError(error.message, AUTH_COPY.signInFailed) };
    }
    return { ok: true, status: "signed-in" };
  } catch (error) {
    return { ok: false, error: unexpected(error, AUTH_COPY.signInFailed) };
  }
}

export async function signUpAction(raw: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const parsed = authSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error, AUTH_COPY.signUpFailed) };
  }

  try {
    const origin = await getSiteOrigin();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { display_name: "Användare", app: "numa" },
        emailRedirectTo: `${origin}${AUTH_CALLBACK_PATH}`,
      },
    });
    if (error) {
      return { ok: false, error: swedishAuthError(error.message, AUTH_COPY.signUpFailed) };
    }
    if (!data.session) {
      return { ok: true, status: "check-email", message: AUTH_COPY.confirmEmail };
    }
    return { ok: true, status: "signed-in" };
  } catch (error) {
    return { ok: false, error: unexpected(error, AUTH_COPY.signUpFailed) };
  }
}

export async function requestPasswordResetAction(raw: {
  email: string;
}): Promise<AuthResult> {
  const parsed = emailSchema.safeParse(raw.email);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error, AUTH_COPY.invalidEmail) };
  }

  try {
    const origin = await getSiteOrigin();
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${origin}${AUTH_CALLBACK_PATH}?type=recovery`,
    });
    if (error && !isUnknownAccount(error.message)) {
      return { ok: false, error: swedishAuthError(error.message, AUTH_COPY.resetFailed) };
    }
    return { ok: true, status: "check-email", message: AUTH_COPY.resetEmailSent };
  } catch (error) {
    return { ok: false, error: unexpected(error, AUTH_COPY.resetFailed) };
  }
}

export async function updatePasswordAction(raw: {
  password: string;
}): Promise<AuthResult> {
  const parsed = passwordSchema.safeParse(raw.password);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error, AUTH_COPY.shortPassword) };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) {
      return { ok: false, error: AUTH_COPY.recoverySessionMissing };
    }

    const { error } = await supabase.auth.updateUser({ password: parsed.data });
    if (error) {
      return { ok: false, error: swedishAuthError(error.message, AUTH_COPY.updateFailed) };
    }
    return { ok: true, status: "signed-in" };
  } catch (error) {
    return { ok: false, error: unexpected(error, AUTH_COPY.updateFailed) };
  }
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}

function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

function unexpected(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[auth]", message);
  return swedishAuthError(message, fallback);
}

/** Supabase may reveal that an address is unknown — we must not. */
function isUnknownAccount(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("user not found") || lower.includes("user_not_found");
}
