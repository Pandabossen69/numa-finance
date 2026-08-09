import Link from "next/link";
import { CreateAccountForm } from "@/components/accounts/CreateAccountForm";

export default function NyttKontoPage() {
  return (
    <div className="animate-rise space-y-6 pt-2">
      <header>
        <Link href="/konton" className="text-sm text-[var(--numa-muted)]">
          ← Konton
        </Link>
        <h1 className="mt-3 text-[1.65rem] font-semibold tracking-[-0.04em]">
          Nytt konto
        </h1>
        <p className="mt-2 text-sm text-[var(--numa-muted)]">
          Ange namn och ett verifierat saldo. Det blir startpunkten för
          beräkningar.
        </p>
      </header>
      <CreateAccountForm />
    </div>
  );
}
