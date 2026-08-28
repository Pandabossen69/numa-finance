import { notFound } from "next/navigation";
import { isNumaAdminEmail } from "@/domain/identity/admin";
import { getAuthUser } from "@/lib/supabase/auth-user";

export const getSessionUser = getAuthUser;

export async function currentUserIsNumaAdmin(): Promise<boolean> {
  const user = await getSessionUser();
  return isNumaAdminEmail(user?.email);
}

export async function requireNumaAdminOrNotFound(): Promise<{
  id: string;
  email: string;
}> {
  const user = await getSessionUser();
  if (!user || !isNumaAdminEmail(user.email)) {
    notFound();
  }
  return user;
}
