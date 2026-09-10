import { notFound } from "next/navigation";
import { isNumaAdminEmail } from "@/domain/identity/admin";
import { getAuthUser } from "@/lib/supabase/auth-user";
import {
  getVerifiedClaimsIdentity,
  getVerifiedServerUser,
  type VerifiedIdentity,
} from "@/lib/supabase/verified-identity";
import {
  ADMIN_NOT_FOUND_SV,
  authorizeAdminCreateUser,
} from "@/features/admin/create-user";

export const getSessionUser = getAuthUser;

export async function currentUserIsNumaAdmin(): Promise<boolean> {
  const identity = await getVerifiedClaimsIdentity();
  return isNumaAdminEmail(identity?.email);
}

export async function requireNumaAdminOrNotFound(): Promise<VerifiedIdentity> {
  const identity = await getVerifiedClaimsIdentity();
  if (!identity || !isNumaAdminEmail(identity.email)) {
    notFound();
  }
  return identity;
}

export async function requireVerifiedAdminForMutation(): Promise<
  { ok: true; identity: VerifiedIdentity } | { ok: false; error: string }
> {
  const identity = await getVerifiedServerUser();
  if (!identity) {
    return { ok: false, error: ADMIN_NOT_FOUND_SV };
  }
  const allowed = authorizeAdminCreateUser(identity.email);
  if (!allowed.ok) {
    return allowed;
  }
  return { ok: true, identity };
}
