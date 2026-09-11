import { notFound } from "next/navigation";
import { isNumaAdminEmail } from "@/domain/identity/admin";
import {
  ADMIN_NOT_FOUND_SV,
  authorizeAdminCreateUser,
} from "@/features/admin/create-user";
import { getAuthUser, getVerifiedAuthUser } from "@/lib/supabase/auth-user";

export const getSessionUser = getAuthUser;

export async function currentUserIsNumaAdmin(): Promise<boolean> {
  const user = await getVerifiedAuthUser();
  return isNumaAdminEmail(user?.email);
}

export async function requireNumaAdminOrNotFound(): Promise<{
  id: string;
  email: string;
}> {
  const user = await getVerifiedAuthUser();
  if (!user || !isNumaAdminEmail(user.email)) {
    notFound();
  }
  return { id: user.id, email: user.email };
}

export async function requireVerifiedAdminForMutation(): Promise<
  | { ok: true; identity: { id: string; email: string } }
  | { ok: false; error: string }
> {
  const user = await getVerifiedAuthUser();
  if (!user) {
    return { ok: false, error: ADMIN_NOT_FOUND_SV };
  }
  const allowed = authorizeAdminCreateUser(user.email);
  if (!allowed.ok) {
    return allowed;
  }
  return { ok: true, identity: { id: user.id, email: user.email } };
}
