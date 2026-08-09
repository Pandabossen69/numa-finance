import Link from "next/link";
import { ReceiptCaptureFlow } from "@/components/capture/ReceiptCaptureFlow";
import { getTodaySnapshotCached } from "@/lib/store/today";

export default async function FotaPage() {
  const snap = await getTodaySnapshotCached();

  if (!snap.primaryAccount) {
    return (
      <div className="space-y-5 pt-4">
        <h1 className="text-[1.65rem] font-semibold tracking-tight">
          Fota kvitto
        </h1>
        <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
          Ange först hur mycket du har just nu — sedan kan du fota kvitton.
        </p>
        <Link
          href="/idag"
          className="flex min-h-14 items-center justify-center rounded-[1.25rem] bg-[var(--numa-accent)] text-[15px] font-semibold text-white"
        >
          Ange mitt saldo
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 pt-2 pb-4">
      <header>
        <p className="text-sm font-medium text-[var(--numa-accent)]">
          Snabbt · kvitto
        </p>
        <h1 className="mt-1 text-[1.65rem] font-semibold tracking-tight">
          Fota och bekräfta
        </h1>
        <p className="mt-2 max-w-[36ch] text-[15px] leading-relaxed text-[var(--numa-muted)]">
          NUMA läser beloppet när det går — du godkänner alltid innan något
          sparas mot din plan.
        </p>
      </header>

      <ReceiptCaptureFlow
        accountId={snap.primaryAccount.id}
        safeToSpendTodayMinor={snap.safeToSpendTodayMinor}
        currency={snap.currency}
      />
    </div>
  );
}
