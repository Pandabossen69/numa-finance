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

  return (
    <div className="space-y-6">
      <header className="animate-rise">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--numa-accent)]">
          Lägg till
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--numa-ink)]">
          {data && !data.hasBankTruth ? "Kom igång" : "Ny rörelse"}
        </h1>
        <p className="mt-2 max-w-[38ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          {data && !data.hasBankTruth
            ? "Börja med bank-SMS — sedan kan du fota kvitton eller skriva belopp manuellt."
            : "Importera från SMS, fota ett pris, eller skriv in beloppet själv."}
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
          bootstrapping={!data.hasBankTruth}
          initialMode={
            data.hasBankTruth ? initialMode : "bank_sms"
          }
        />
      ) : (
        <p className="text-sm text-[var(--numa-muted)]">Kunde inte ladda.</p>
      )}
    </div>
  );
}
