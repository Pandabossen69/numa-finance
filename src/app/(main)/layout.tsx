import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { BindLastKnownUser } from "@/components/layout/BindLastKnownUser";
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
        <Suspense fallback="Användare">
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
    return (
      <>
        <BindLastKnownUser
          userId={profile.id}
          displayName={profile.displayName}
        />
        {profile.displayName}
      </>
    );
  } catch (error) {
    console.error("[numa] layout profile failed", error);
    return "Användare";
  }
}
