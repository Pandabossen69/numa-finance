import { z } from "zod";
import { isNumaAdminEmail } from "@/domain/identity/admin";
import { EMAIL_INVALID_MESSAGE, isPlausibleEmail } from "@/domain/identity/email";

export const SERVICE_ROLE_MISSING_SV =
  "Servernyckeln saknas. Lägg till SUPABASE_SERVICE_ROLE_KEY i Vercel (Preview och Production) och deploya om.";

export const ADMIN_NOT_FOUND_SV = "Sidan finns inte";

export const CREATE_USER_SUCCESS_SV =
  "Kontot skapades. Personen kan logga in på /logga-in med e-post och lösenord.";

const createUserSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, EMAIL_INVALID_MESSAGE)
    .refine((value) => isPlausibleEmail(value), EMAIL_INVALID_MESSAGE)
    .refine(
      (value) => z.string().email().safeParse(value).success,
      EMAIL_INVALID_MESSAGE,
    ),
  password: z.string().min(8, "Lösenordet måste vara minst 8 tecken"),
  displayName: z
    .string()
    .trim()
    .max(40, "Visningsnamnet får vara högst 40 tecken")
    .optional(),
});

export type CreateUserInput = {
  email: string;
  password: string;
  displayName?: string;
};

export type CreateUserResult =
  { ok: true; email: string; displayName: string } | { ok: false; error: string };

export function authorizeAdminCreateUser(
  email: string | null | undefined,
): { ok: true } | { ok: false; error: string } {
  if (!isNumaAdminEmail(email)) {
    return { ok: false, error: ADMIN_NOT_FOUND_SV };
  }
  return { ok: true };
}

export function parseCreateUserInput(raw: {
  email: string;
  password: string;
  displayName?: string;
}): { ok: true; input: CreateUserInput } | { ok: false; error: string } {
  const parsed = createUserSchema.safeParse({
    email: raw.email,
    password: raw.password,
    displayName: raw.displayName?.trim() ? raw.displayName : undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? EMAIL_INVALID_MESSAGE,
    };
  }
  const displayName = parsed.data.displayName?.trim();
  return {
    ok: true,
    input: {
      email: parsed.data.email.trim().toLowerCase(),
      password: parsed.data.password,
      displayName: displayName ? displayName : undefined,
    },
  };
}

export function swedishCreateUserError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("already registered") ||
    lower.includes("already been registered") ||
    lower.includes("user already exists")
  ) {
    return "E-postadressen finns redan";
  }
  if (lower.includes("password")) {
    return "Lösenordet måste vara minst 8 tecken";
  }
  return message;
}
