import { AppShell } from "@/components/layout/AppShell";
import { redirectIfOnboardingIncomplete } from "@/features/onboarding/redirect";
import { getProfile } from "@/lib/store/repository";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await redirectIfOnboardingIncomplete();

  let displayName = "Användare";
  try {
    const profile = await getProfile();
    displayName = profile.displayName;
  } catch (error) {
    console.error("[numa] layout profile failed", error);
  }

  return <AppShell displayName={displayName}>{children}</AppShell>;
}
