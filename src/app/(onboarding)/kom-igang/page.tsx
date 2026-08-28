import { OnboardingSaldoChoice } from "@/lib/route-islands";
import { requireSaldoOnboardingPage } from "@/features/onboarding/redirect";

export const dynamic = "force-dynamic";

/** Choice UI is static — do not await the gate before first paint. */
export default function KomIgangPage() {
  return (
    <>
      <SaldoOnboardingGuard />
      <OnboardingSaldoChoice />
    </>
  );
}

async function SaldoOnboardingGuard() {
  await requireSaldoOnboardingPage();
  return null;
}
