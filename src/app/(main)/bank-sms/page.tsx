import { PageLoadError } from "@/components/ui/PageLoadError";
import { BankSmsImportFlow } from "@/components/imports/BankSmsImportFlow";
import { safeLoadTodaySnapshot } from "@/lib/store/load-snapshot";

export default async function BankSmsPage() {
  const loaded = await safeLoadTodaySnapshot();
  if (!loaded.ok) {
    return <PageLoadError title="Kunde inte öppna bank-SMS" />;
  }
  const snap = loaded.snap;

  if (!snap.primaryAccount) {
    return (
      <div className="space-y-5 pt-4 text-[var(--numa-ink)]">
        <h1 className="text-[1.65rem] font-semibold tracking-tight">
          Bank-SMS
        </h1>
        <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
          Ange först hur mycket du har just nu — sedan kan du importera
          Bangkok Bank-SMS.
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
        <a href="/importera" className="text-sm text-[var(--numa-muted)]">
          ← Importer
        </a>
        <p className="mt-3 text-sm font-medium text-[var(--numa-accent)]">
          Efter köpet
        </p>
        <h1 className="mt-1 text-[1.65rem] font-semibold tracking-tight">
          Importera bank-SMS
        </h1>
        <p className="mt-2 max-w-[36ch] text-[15px] leading-relaxed text-[var(--numa-muted)]">
          Skärmdumpa SMS från Bangkok Bank. Belopp och remaining balance läses
          in — samma betalning sparas inte två gånger.
        </p>
      </header>

      <BankSmsImportFlow
        accountId={snap.primaryAccount.id}
        accounts={snap.accounts.map((a) => ({
          id: a.id,
          name: a.name,
          accountType: a.accountType,
        }))}
        currency={snap.currency}
      />
    </div>
  );
}
