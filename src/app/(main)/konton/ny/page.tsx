import Link from "next/link";
import { CreateAccountForm } from "@/components/accounts/CreateAccountForm";

export default function NyttKontoPage() {
  return (
    <div className="space-y-6 pt-2 text-[var(--numa-ink)]">
      <header className="space-y-2">
        <Link href="/idag" className="text-sm font-medium text-[var(--numa-muted)]">
          ← Tillbaka
        </Link>
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">
          Ditt saldo i NUMA
        </h1>
        <p className="text-[15px] leading-relaxed text-[var(--numa-muted)]">
          Ingen bankkoppling. Du anger hur mycket du har just nu — NUMA använder
          det som startpunkt för planen.
        </p>
      </header>
      <CreateAccountForm />
    </div>
  );
}
