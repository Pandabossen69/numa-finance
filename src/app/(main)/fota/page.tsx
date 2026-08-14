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
      : modeParam === "bank_app" ||
          modeParam === "bunq" ||
          modeParam === "revolut"
        ? ("bank_app" as const)
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
    <div className="mx-auto max-w-lg space-y-6">
      {home.ok === false || !data ? (
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Lägg till</h1>
          <p className="text-sm text-[var(--numa-danger)]">
            {home.ok === false ? home.error : "Kunde inte ladda."}
          </p>
        </div>
      ) : (
        <ReceiptCaptureFlow
          accountId={data.primaryAccountId}
          accounts={accounts}
          perDayBudgetMinor={data.perDayBudgetMinor}
          todaySpendingMinor={data.todaySpendingMinor}
          currency={data.currency}
          bootstrapping={bootstrapping}
          initialMode={bootstrapping ? "bank_sms" : initialMode}
        />
      )}
    </div>
  );
}
