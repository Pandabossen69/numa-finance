import { OnboardingSaldoChoice } from "@/components/onboarding/OnboardingSaldoChoice";
import { requireSaldoOnboardingPage } from "@/features/onboarding/redirect";

export const dynamic = "force-dynamic";

export default async function KomIgangPage() {
  await requireSaldoOnboardingPage();
  return <OnboardingSaldoChoice />;
}
