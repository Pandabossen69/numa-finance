import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { InstallningarScreen } from "@/components/mer/InstallningarScreen";
import { chromeDisplayName } from "@/domain/identity/display-name";
import { getProfile } from "@/lib/store/repository";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { currentUserIsNumaAdmin } from "@/features/auth/session";

export default function InstallningarPage() {
  return (
    <Suspense fallback={<InstallningarScreen data={null} />}>
      <InstallningarBody />
    </Suspense>
  );
}

async function InstallningarBody() {
  let profile: Awaited<ReturnType<typeof getProfile>> | null = null;
  try {
    profile = await getProfile();
  } catch (error) {
    unstable_rethrow(error);
    console.error("[numa] installningar failed", error);
  }
  const supabaseReady = isSupabaseConfigured();
  const isAdmin = await currentUserIsNumaAdmin();

  return (
    <InstallningarScreen
      data={
        profile
          ? {
              userId: profile.id,
              displayName: chromeDisplayName(profile.displayName),
              timezone: profile.timezone,
              primaryCurrency: profile.primaryCurrency,
              supabaseReady,
              isAdmin,
            }
          : null
      }
      profileMissing={!profile}
    />
  );
}
