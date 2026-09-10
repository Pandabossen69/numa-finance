import { cache } from "react";
import { withTimeout } from "@/lib/async";
import { isSupabaseConfigured } from "./config";
import { createSupabaseServerClient } from "./server";

export type VerifiedIdentity = {
  id: string;
  email: string;
};

const VERIFY_TIMEOUT_MS = 2_000;

function trimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Map verified JWT claims to an identity. Email comes from the `email`
 * claim only — never from `user_metadata`.
 */
export function identityFromVerifiedClaims(data: {
  claims?: {
    sub?: unknown;
    email?: unknown;
    user_metadata?: unknown;
    app_metadata?: unknown;
  } | null;
} | null): VerifiedIdentity | null {
  const claims = data?.claims;
  if (!claims) return null;
  const id = trimmedString(claims.sub);
  if (!id) return null;
  return { id, email: trimmedString(claims.email) };
}

/**
 * Map a server-confirmed Auth user. Email comes from `user.email` only —
 * never from `user_metadata`.
 */
export function identityFromVerifiedUser(user: {
  id?: unknown;
  email?: unknown;
  user_metadata?: unknown;
  app_metadata?: unknown;
} | null | undefined): VerifiedIdentity | null {
  if (!user) return null;
  const id = trimmedString(user.id);
  if (!id) return null;
  return { id, email: trimmedString(user.email) };
}

export async function readVerifiedClaimsIdentity(): Promise<VerifiedIdentity | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const result = await withTimeout(
      supabase.auth.getClaims(),
      VERIFY_TIMEOUT_MS,
      "getVerifiedClaims",
    );
    if (result.error || !result.data) return null;
    return identityFromVerifiedClaims(result.data);
  } catch {
    return null;
  }
}

export async function readVerifiedServerUser(): Promise<VerifiedIdentity | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const result = await withTimeout(
      supabase.auth.getUser(),
      VERIFY_TIMEOUT_MS,
      "getVerifiedServerUser",
    );
    if (result.error || !result.data.user) return null;
    return identityFromVerifiedUser(result.data.user);
  } catch {
    return null;
  }
}

/** Request-scoped JWT verification for page protection. Not a global cache. */
export const getVerifiedClaimsIdentity = cache(readVerifiedClaimsIdentity);

/**
 * Request-scoped Auth-server identity for admin/service-role mutations.
 * Fresh enough to observe revocation. Not a global cache.
 */
export const getVerifiedServerUser = cache(readVerifiedServerUser);
