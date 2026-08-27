import Link from "next/link";
import { ReceiptCaptureFlow } from "@/components/capture/ReceiptCaptureFlow";
import { RetryLoadButton } from "@/components/ui/RetryLoadButton";
import { getCachedTodaySnapshot, loadHomeSnapshot } from "@/features/finance/load-home";
import { ONBOARDING_SV as C } from "@/features/onboarding/copy";
import { HOME_PATH, ONBOARDING_SALDO_PATH } from "@/features/onboarding/paths";
import { requireSaldoOnboardingPage } from "@/features/onboarding/redirect";

export const dynamic = "force-dynamic";

export default async function OnboardingFotaPage() {
  await requireSaldoOnboardingPage();

  const [home, snap] = await Promise.all([
    loadHomeSnapshot(),
    getCachedTodaySnapshot().catch(() => null),
  ]);
  const data = home.ok ? home.data : null;
  const accounts =
    snap?.accounts
      .filter((a) => a.isActive)
      .map((a) => ({
        id: a.id,
        name: a.name,
        accountType: a.accountType,
        currency: a.currency,
      })) ?? [];

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col space-y-6 md:mx-auto md:max-w-lg md:flex-none">
      <Link
        href={ONBOARDING_SALDO_PATH}
        className="numa-press inline-flex min-h-11 w-fit items-center text-sm font-semibold text-[var(--numa-accent)] transition hover:text-[var(--numa-accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)] focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        ← {C.back}
      </Link>
      {home.ok === false || !data ? (
        <div className="numa-panel numa-error space-y-3">
          <h1 className="numa-page-title">{C.fotaTitle}</h1>
          <p className="text-sm text-[var(--numa-muted)]">
            {home.ok === false ? home.error : "Kunde inte ladda Fota."}
          </p>
          <RetryLoadButton />
        </div>
      ) : (
        <ReceiptCaptureFlow
          accountId={data.primaryAccountId}
          accounts={accounts}
          remainingTodayMinor={data.remainingTodayMinor}
          currency={data.currency}
          bootstrapping
          initialMode="pick"
          variant="onboarding"
          fromOnboarding
          successHref={HOME_PATH}
        />
      )}
    </div>
  );
}
