import { CreateAccountForm } from "@/components/accounts/CreateAccountForm";
import { QuickAddForms } from "@/components/add/QuickAddForms";
import { PageLoadError } from "@/components/ui/PageLoadError";
import { safeLoadTodaySnapshot } from "@/lib/store/load-snapshot";

/** Full-page add flow — works even when client JS sheets are broken. */
export default async function LaggTillPage() {
  const loaded = await safeLoadTodaySnapshot();
  const snap = loaded.ok ? loaded.snap : null;

  if (!snap) {
    return <PageLoadError title="Kunde inte öppna Lägg till" />;
  }

  if (!snap.primaryAccount) {
    return (
      <div className="space-y-5 pt-2 pb-4 text-[var(--numa-ink)]">
        <header>
          <a href="/idag" className="text-sm text-[var(--numa-muted)]">
            ← Idag
          </a>
          <h1 className="mt-3 text-[1.65rem] font-semibold tracking-tight">
            Lägg till saldo
          </h1>
          <p className="mt-2 max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
            NUMA behöver först veta hur mycket du har just nu.
          </p>
        </header>
        <CreateAccountForm />
      </div>
    );
  }

  const accounts = snap.accounts.map((a) => ({
    id: a.id,
    name: a.name,
    accountType: a.accountType,
  }));

  return (
    <div className="space-y-5 pt-2 pb-4 text-[var(--numa-ink)]">
      <header>
        <a href="/idag" className="text-sm text-[var(--numa-muted)]">
          ← Idag
        </a>
        <h1 className="mt-3 text-[1.65rem] font-semibold tracking-tight">
          Lägg till
        </h1>
        <p className="mt-2 max-w-[36ch] text-[15px] leading-relaxed text-[var(--numa-muted)]">
          Fota, importera bank-SMS eller skriv in beloppet manuellt.
        </p>
      </header>

      <div className="space-y-3">
        <a
          href="/fota"
          className="flex min-h-14 w-full flex-col justify-center rounded-[1.25rem] bg-[var(--numa-accent)] px-4 text-left text-white"
        >
          <span className="text-[15px] font-semibold">Fota kvitto</span>
          <span className="text-xs text-white/80">
            Kameran öppnas — bekräfta belopp
          </span>
        </a>
        <a
          href="/bank-sms"
          className="flex min-h-14 w-full flex-col justify-center rounded-[1.25rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-4 text-left"
        >
          <span className="text-[15px] font-semibold">Importera bank-SMS</span>
          <span className="text-xs text-[var(--numa-faint)]">
            Skärmdump efter köp — belopp + saldo
          </span>
        </a>
        <a
          href="/konton"
          className="flex min-h-14 w-full flex-col justify-center rounded-[1.25rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-4 text-left"
        >
          <span className="text-[15px] font-semibold">Uppdatera saldo</span>
          <span className="text-xs text-[var(--numa-faint)]">
            Håll NUMA i fas med banken
          </span>
        </a>
      </div>

      <QuickAddForms
        primaryAccountId={snap.primaryAccount.id}
        accounts={accounts}
      />
    </div>
  );
}
