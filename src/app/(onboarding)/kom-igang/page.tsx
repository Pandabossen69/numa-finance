import { OnboardingSaldoChoice } from "@/lib/route-islands";
import { requireSaldoOnboardingPage } from "@/features/onboarding/redirect";

export const dynamic = "force-dynamic";

export default async function KomIgangPage() {
  await requireSaldoOnboardingPage();
  return <OnboardingSaldoChoice />;
}
