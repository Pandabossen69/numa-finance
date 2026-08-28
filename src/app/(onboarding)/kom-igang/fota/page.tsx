import Link from "next/link";
import { ONBOARDING_SV as C } from "@/features/onboarding/copy";
import {
  HOME_PATH,
  ONBOARDING_SALDO_PATH,
} from "@/features/onboarding/paths";
import { requireSaldoOnboardingPage } from "@/features/onboarding/redirect";
import { ReceiptCaptureFlow } from "@/lib/route-islands";

export const dynamic = "force-dynamic";

export default async function OnboardingFotaPage() {
  const state = await requireSaldoOnboardingPage();
  const currency = state.profile?.primaryCurrency ?? "THB";
  const accounts = state.accounts
    .filter((account) => account.isActive)
    .map((account) => ({
      id: account.id,
      name: account.name,
      accountType: account.accountType,
      currency: account.currency,
    }));

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col space-y-6 md:mx-auto md:max-w-lg md:flex-none">
      <Link
        href={ONBOARDING_SALDO_PATH}
        className="numa-press inline-flex min-h-11 w-fit items-center text-sm font-semibold text-[var(--numa-accent)] transition hover:text-[var(--numa-accent-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)] focus-visible:ring-offset-2"
      >
        ← {C.back}
      </Link>
      <ReceiptCaptureFlow
        accountId={accounts[0]?.id ?? null}
        accounts={accounts}
        remainingTodayMinor={0}
        currency={currency}
        bootstrapping
        initialMode="pick"
        variant="onboarding"
        fromOnboarding
        successHref={HOME_PATH}
      />
    </div>
  );
}
