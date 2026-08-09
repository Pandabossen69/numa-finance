import Link from "next/link";
import { CreateAccountForm } from "@/components/accounts/CreateAccountForm";
import { listAccounts } from "@/lib/store/repository";

export default async function NyttKontoPage() {
  const accounts = await listAccounts();
  const hasExisting = accounts.length > 0;

  return (
    <div className="space-y-6 pt-2 text-[var(--numa-ink)]">
      <header className="space-y-2">
        <Link
          href={hasExisting ? "/konton" : "/idag"}
          className="text-sm font-medium text-[var(--numa-muted)]"
        >
          ← Tillbaka
        </Link>
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">
          {hasExisting ? "Lägg till saldo" : "Ditt saldo i NUMA"}
        </h1>
        <p className="text-[15px] leading-relaxed text-[var(--numa-muted)]">
          {hasExisting
            ? "Sparkonto, kontanter eller ett till bankkonto — utan att stjäla ditt nuvarande standardkonto, om du inte vill."
            : "Ingen bankkoppling. Du anger hur mycket du har just nu — NUMA använder det som startpunkt för planen."}
        </p>
      </header>
      <CreateAccountForm hasExistingAccounts={hasExisting} />
    </div>
  );
}
