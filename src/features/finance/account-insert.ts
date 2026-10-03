import { isUniqueViolationMessage } from "@/domain/finance";

/** PostgREST / Postgres shape we branch on. Never throw from this helper. */
export type AccountInsertError = {
  code?: string | null;
  message?: string | null;
};

/**
 * What to do when `numa.accounts` insert fails.
 *
 * - `replay`: unique (user_id, client_mutation_id) — the account is already saved.
 * - `omit-column`: shared DB is missing `client_mutation_id` (PGRST204 / 42703).
 *   Retry once without the field. Not the main path now that the column is live.
 * - `fail`: surface the error.
 */
export function accountInsertFailure(
  error: AccountInsertError,
): "replay" | "omit-column" | "fail" {
  const code = (error.code ?? "").toUpperCase();
  const message = error.message ?? "";
  if (code === "23505" || isUniqueViolationMessage(message)) return "replay";
  if (isMissingClientMutationColumn(code, message)) return "omit-column";
  return "fail";
}

function isMissingClientMutationColumn(code: string, message: string): boolean {
  if (code === "PGRST204" || code === "42703") return true;
  const text = message.toLowerCase();
  if (!text.includes("client_mutation_id")) return false;
  return (
    text.includes("schema cache") ||
    text.includes("could not find") ||
    text.includes("does not exist") ||
    text.includes("pgrst204") ||
    text.includes("42703")
  );
}
