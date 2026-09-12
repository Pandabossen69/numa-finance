import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { HomeCookieSeed } from "@/components/layout/HomeCookieSeed";
import { SessionOwnerBinder } from "@/components/layout/SessionOwnerBinder";
import { ShellDisplayNameFallback } from "@/components/layout/ShellDisplayNameFallback";
import { chromeDisplayName } from "@/domain/identity/display-name";
import { readLastHomeCookie } from "@/features/home/last-home-cookie.server";
import { redirectIfOnboardingIncomplete } from "@/features/onboarding/redirect";
import { getProfile } from "@/lib/store/repository";

export const dynamic = "force-dynamic";

/**
 * Sync shell chrome — never await session/profile/cookie here.
 * Cookie SSR seeds the module shell via HomeCookieSeed (Suspense) so
 * TabKeepAlive can mount immediately and paint lastHomeShellSnapshot
 * (login seed / persist hydrate) without a blank Suspense gap.
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell
      displayName={
        <Suspense fallback={<ShellDisplayNameFallback />}>
          <ShellDisplayName />
        </Suspense>
      }
    >
      <Suspense fallback={null}>
        <HomeCookieSeedFromServer />
      </Suspense>
      <Suspense fallback={null}>
        <OnboardingRedirect />
      </Suspense>
      {children}
    </AppShell>
  );
}

async function HomeCookieSeedFromServer() {
  const shell = await readLastHomeCookie();
  return <HomeCookieSeed shell={shell} />;
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
