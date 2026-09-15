import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SessionOwnerBinder } from "@/components/layout/SessionOwnerBinder";
import { ShellDisplayNameFallback } from "@/components/layout/ShellDisplayNameFallback";
import { chromeDisplayName } from "@/domain/identity/display-name";
import { resolveHomeShell } from "@/features/home/last-home-cookie.server";
import { redirectIfOnboardingIncomplete } from "@/features/onboarding/redirect";
import { getProfile } from "@/lib/store/repository";

export const dynamic = "force-dynamic";

/**
 * Await Hem shell before mounting AppShell/TabKeepAlive so the visible /idag
 * panel can SSR Kvar/Över (SPEC 6b/6d). Cookie hit = warm fast path; cookie
 * miss for an authenticated session loads a live slim snapshot so cold login
 * is not a long blank. Fail-closes when userId is not the current session.
 * Profile and onboarding stay in Suspense.
 */
export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const homeCookieShell = await resolveHomeShell();
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
