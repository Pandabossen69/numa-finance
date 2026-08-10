import { PageLoadError } from "@/components/ui/PageLoadError";
import { ReceiptCaptureFlow } from "@/components/capture/ReceiptCaptureFlow";
import { safeLoadTodaySnapshot } from "@/lib/store/load-snapshot";

export default async function FotaPage() {
  const loaded = await safeLoadTodaySnapshot();
  if (!loaded.ok) {
    return <PageLoadError title="Kunde inte öppna Fota" />;
  }
  const snap = loaded.snap;

  if (!snap.primaryAccount) {
    return (
      <div className="space-y-5 pt-4 text-[var(--numa-ink)]">
        <h1 className="text-[1.65rem] font-semibold tracking-tight">
          Fota kvitto
        </h1>
        <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
          Ange först hur mycket du har just nu — sedan kan du fota kvitton.
        </p>
        <a
          href="/idag"
          className="flex min-h-14 items-center justify-center rounded-[1.25rem] bg-[var(--numa-accent)] text-[15px] font-semibold text-white"
        >
          Ange mitt saldo
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5 pt-2 pb-4 text-[var(--numa-ink)]">
      <header>
        <a href="/lagg-till" className="text-sm text-[var(--numa-muted)]">
          ← Lägg till
        </a>
        <p className="mt-3 text-sm font-medium text-[var(--numa-accent)]">
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
        accounts={snap.accounts.map((a) => ({
          id: a.id,
          name: a.name,
          accountType: a.accountType,
        }))}
        safeToSpendTodayMinor={snap.safeToSpendTodayMinor}
        currency={snap.currency}
      />
    </div>
  );
}
