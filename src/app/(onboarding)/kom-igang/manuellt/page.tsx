import { OnboardingManualSaldo } from "@/components/onboarding/OnboardingManualSaldo";
import { requireSaldoOnboardingPage } from "@/features/onboarding/redirect";

export const dynamic = "force-dynamic";

export default async function OnboardingManualPage() {
  const state = await requireSaldoOnboardingPage();
  const currency = state.profile?.primaryCurrency ?? "THB";
  return <OnboardingManualSaldo currency={currency} />;
}
