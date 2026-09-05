import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SessionOwnerBinder } from "@/components/layout/SessionOwnerBinder";
import { ShellDisplayNameFallback } from "@/components/layout/ShellDisplayNameFallback";
import { chromeDisplayName } from "@/domain/identity/display-name";
import { redirectIfOnboardingIncomplete } from "@/features/onboarding/redirect";
import { getProfile } from "@/lib/store/repository";

export const dynamic = "force-dynamic";

/**
 * Sync shell — never await session/profile here. An async layout blocked
 * Hem/Plan chrome (and every tab prefetch) until onboarding + profile settled.
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
