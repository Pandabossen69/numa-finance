import { cache } from "react";
import { notFound } from "next/navigation";
import { isNumaAdminEmail } from "@/domain/identity/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const getSessionUser = cache(
  async (): Promise<{
    id: string;
    email: string;
  } | null> => {
    if (!isSupabaseConfigured()) return null;
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;
    return { id: user.id, email: user.email ?? "" };
  },
);

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
