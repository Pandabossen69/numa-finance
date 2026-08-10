import Link from "next/link";
import { ReceiptCaptureFlow } from "@/components/capture/ReceiptCaptureFlow";
import { loadHomeSnapshot } from "@/features/finance/load-home";

export default async function FotaPage() {
  const result = await loadHomeSnapshot();
  const snap = result.ok ? result.data : null;

  return (
    <div className="space-y-5">
      <header className="animate-rise">
        <p className="text-sm font-medium text-[var(--numa-accent)]">
          Bank-SMS · start
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--numa-ink)]">
          Fota och bekräfta
        </h1>
        <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          {snap && !snap.hasBankTruth
            ? "Första SMS:et sätter hur mycket du har (available balance) och sparar beloppet som drogs. Allt är noll tills dess."
            : "Läser alla SMS i bilden, sparar bara den senaste nya — saldo efter uppdateras från banken."}
        </p>
      </header>

      {result.ok === false ? (
        <p className="text-sm text-[var(--numa-danger)]">{result.error}</p>
      ) : null}

      {snap ? (
        <ReceiptCaptureFlow
          accountId={snap.primaryAccountId}
          safeToSpendTodayMinor={snap.safeToSpendTodayMinor}
          todaySpendingMinor={snap.todaySpendingMinor}
          currency={snap.currency}
          bootstrapping={!snap.hasBankTruth}
        />
      ) : (
        <Link href="/idag" className="text-sm font-semibold text-[var(--numa-accent)]">
          Tillbaka till Hem →
        </Link>
      )}
    </div>
  );
}
