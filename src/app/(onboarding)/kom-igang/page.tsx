import nextDynamic from "next/dynamic";
import { requireSaldoOnboardingPage } from "@/features/onboarding/redirect";

export const dynamic = "force-dynamic";

const OnboardingSaldoChoice = nextDynamic(() =>
  import("@/components/onboarding/OnboardingSaldoChoice").then(
    (mod) => mod.OnboardingSaldoChoice,
  ),
);

export default async function KomIgangPage() {
  await requireSaldoOnboardingPage();
  return <OnboardingSaldoChoice />;
}
