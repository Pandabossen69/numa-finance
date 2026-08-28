import nextDynamic from "next/dynamic";
import { requireSaldoOnboardingPage } from "@/features/onboarding/redirect";

export const dynamic = "force-dynamic";

const OnboardingManualSaldo = nextDynamic(() =>
  import("@/components/onboarding/OnboardingManualSaldo").then(
    (mod) => mod.OnboardingManualSaldo,
  ),
);

export default async function OnboardingManualPage() {
  const state = await requireSaldoOnboardingPage();
  const currency = state.profile?.primaryCurrency ?? "THB";
  return <OnboardingManualSaldo currency={currency} />;
}
