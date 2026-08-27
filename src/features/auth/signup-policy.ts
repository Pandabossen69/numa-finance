import type { AuthResult } from "./result";

export const PUBLIC_SIGNUP_CLOSED_MESSAGE =
  "Nya konton skapas bara av NUMA. Logga in om du redan har konto.";

/** Public self-signup is closed in the app. Callers must not hit Auth signUp. */
export function rejectPublicSignup(): AuthResult {
  return { ok: false, error: PUBLIC_SIGNUP_CLOSED_MESSAGE };
}
