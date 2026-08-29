import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SessionOwnerBinder } from "@/components/layout/SessionOwnerBinder";
import { ShellDisplayNameFallback } from "@/components/layout/ShellDisplayNameFallback";
import { chromeDisplayName } from "@/domain/identity/display-name";
import { redirectIfOnboardingIncomplete } from "@/features/onboarding/redirect";
import { getProfile } from "@/lib/store/repository";

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
  try {
    const profile = await getProfile();
    const name = chromeDisplayName(profile.displayName);
    return (
      <>
        <SessionOwnerBinder userId={profile.id} />
        {name}
      </>
    );
  } catch (error) {
    console.error("[numa] layout profile failed", error);
    return <ShellDisplayNameFallback />;
  }
}
