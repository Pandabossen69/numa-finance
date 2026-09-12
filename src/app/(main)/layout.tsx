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
 * Sync shell chrome — never await session/profile here. Cookie SSR for
 * Christian-bar Hem lives in MainLayoutWithCookie (Suspense), so TabKeepAlive
 * can paint last-known without blocking first shell paint on profile.
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <AppShell
          homeCookieShell={null}
          displayName={<ShellDisplayNameFallback />}
        >
          {children}
        </AppShell>
      }
    >
      <MainLayoutWithCookie>{children}</MainLayoutWithCookie>
    </Suspense>
  );
}

async function MainLayoutWithCookie({
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
