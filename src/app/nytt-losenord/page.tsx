import { redirect } from "next/navigation";
import { NewPasswordScreen } from "@/components/auth/NewPasswordScreen";
import {
  newPasswordEntry,
  searchParamsToURLSearchParams,
} from "@/features/auth/recovery-link";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NyttLosenordPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParamsToURLSearchParams((await searchParams) ?? {});
  const entry = newPasswordEntry(params);
  if (entry.type === "exchange") redirect(entry.href);
  if (entry.type === "invalid") return <NewPasswordScreen mode="invalid" />;
  if (entry.type === "rate-limit") return <NewPasswordScreen mode="rate-limit" />;

  if (!isSupabaseConfigured()) return <NewPasswordScreen mode="invalid" />;
  let hasRecoverySession = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    hasRecoverySession = !error && Boolean(data.user);
  } catch {
    hasRecoverySession = false;
  }
  if (!hasRecoverySession) return <NewPasswordScreen mode="invalid" />;
  return <NewPasswordScreen mode="ready" />;
}
