"use server";

import "server-only";

import { getSessionUser } from "@/features/auth/session";
import {
  authorizeAdminCreateUser,
  CREATE_USER_SUCCESS_SV,
  parseCreateUserInput,
  SERVICE_ROLE_MISSING_SV,
  swedishCreateUserError,
  type CreateUserResult,
} from "@/features/admin/create-user";
import {
  createSupabaseServiceRoleClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";

export type { CreateUserResult };

export async function createUserAction(raw: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<CreateUserResult> {
  const session = await getSessionUser();
  const allowed = authorizeAdminCreateUser(session?.email);
  if (!allowed.ok) {
    return allowed;
  }

  const parsed = parseCreateUserInput(raw);
  if (!parsed.ok) {
    return parsed;
  }

  if (!isServiceRoleConfigured()) {
    return { ok: false, error: SERVICE_ROLE_MISSING_SV };
  }

  try {
    const admin = createSupabaseServiceRoleClient();
    const displayName = parsed.input.displayName?.trim() || "Användare";
    const { data, error } = await admin.auth.admin.createUser({
      email: parsed.input.email,
      password: parsed.input.password,
      email_confirm: true,
      user_metadata: { display_name: displayName, app: "numa" },
    });

    if (error) {
      return { ok: false, error: swedishCreateUserError(error.message) };
    }

    const userId = data.user?.id;
    if (!userId) {
      return { ok: false, error: "Kontot skapades inte. Försök igen." };
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("[numa] admin profile lookup failed", profileError);
    }

    if (!profile) {
      const { error: insertError } = await admin.from("profiles").insert({
        id: userId,
        display_name: displayName,
        timezone: "Asia/Bangkok",
        primary_currency: "THB",
        reference_currency: "SEK",
      });
      if (insertError) {
        return {
          ok: false,
          error:
            "Användaren skapades i inloggningen, men profilen saknas. Försök igen eller kolla Supabase-loggen.",
        };
      }
    }

    return {
      ok: true,
      email: parsed.input.email,
      displayName,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? swedishCreateUserError(error.message)
          : "Kunde inte skapa användare",
    };
  }
}

export { CREATE_USER_SUCCESS_SV };
