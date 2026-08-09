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
          Lägg till bankkonto
        </h1>
        <p className="text-[15px] leading-relaxed text-[var(--numa-muted)]">
          Du är inloggad. Nu behövs ett bankkonto med verifierat saldo — det är
          startpunkten för dagens plan och live plus/minus.
        </p>
      </header>
      <CreateAccountForm />
    </div>
  );
}
