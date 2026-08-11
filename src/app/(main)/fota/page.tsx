import { ReceiptCaptureFlow } from "@/components/capture/ReceiptCaptureFlow";
import {
  getCachedTodaySnapshot,
  loadHomeSnapshot,
} from "@/features/finance/load-home";

export default async function FotaPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const modeParam = params.mode;
  const initialMode =
    modeParam === "sms" || modeParam === "bank_sms"
      ? ("bank_sms" as const)
      : modeParam === "kvitto" || modeParam === "receipt"
        ? ("receipt" as const)
        : modeParam === "manual"
          ? ("manual" as const)
          : ("pick" as const);

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
      })) ?? [];

  const bootstrapping = Boolean(data && !data.hasBankTruth);

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <header className="animate-rise">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--numa-ink)]">
          Lägg till
        </h1>
        <p className="mt-2 max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          {bootstrapping
            ? "Välj galleri eller kamera — bank-SMS läses in automatiskt."
            : "Bank-SMS läses in automatiskt. Saldo och dagsbudget synkar direkt."}
        </p>
      </header>

      {home.ok === false ? (
        <p className="text-sm text-[var(--numa-danger)]">{home.error}</p>
      ) : null}

      {data ? (
        <ReceiptCaptureFlow
          accountId={data.primaryAccountId}
          accounts={accounts}
          perDayBudgetMinor={data.perDayBudgetMinor}
          todaySpendingMinor={data.todaySpendingMinor}
          currency={data.currency}
          bootstrapping={bootstrapping}
          initialMode={bootstrapping ? "bank_sms" : initialMode}
        />
      ) : (
        <p className="text-sm text-[var(--numa-muted)]">Kunde inte ladda.</p>
      )}
    </div>
  );
}
