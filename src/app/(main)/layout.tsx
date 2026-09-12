import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SessionOwnerBinder } from "@/components/layout/SessionOwnerBinder";
import { ShellDisplayNameFallback } from "@/components/layout/ShellDisplayNameFallback";
import { chromeDisplayName } from "@/domain/identity/display-name";
import { readLastHomeCookie } from "@/features/home/last-home-cookie.server";
import { redirectIfOnboardingIncomplete } from "@/features/onboarding/redirect";
import { getProfile } from "@/lib/store/repository";

export const dynamic = "force-dynamic";

/**
 * Cookie is a cheap sync read for Christian-bar Hem SSR into TabKeepAlive.
 * Profile/onboarding stay in Suspense — never block shell chrome on them.
 */
export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const homeCookieShell = await readLastHomeCookie();
  return (
    <AppShell
      homeCookieShell={homeCookieShell}
      displayName={
        <Suspense fallback={<ShellDisplayNameFallback />}>
          <ShellDisplayName />
        </Suspense>
      }
    >
      <Suspense fallback={null}>
        <OnboardingRedirect />
      </Suspense>
      {children}
    </AppShell>
  );
}

async function OnboardingRedirect() {
  await redirectIfOnboardingIncomplete();
  return null;
}

async function ShellDisplayName() {
  let profile: Awaited<ReturnType<typeof getProfile>> | null = null;
  try {
    profile = await getProfile();
  } catch (error) {
    // cookies() and redirect() throw for Next to catch. Swallowing those
    // would break the static/dynamic bail-out, not just hide a bug.
    unstable_rethrow(error);
    console.error("[numa] layout profile failed", error);
  }

  if (!profile) return <ShellDisplayNameFallback />;

  return (
    <>
      <SessionOwnerBinder userId={profile.id} />
      {chromeDisplayName(profile.displayName)}
    </>
  );
}
