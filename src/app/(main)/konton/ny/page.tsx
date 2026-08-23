import Link from "next/link";
import { CreateAccountForm } from "@/components/accounts/CreateAccountForm";

export default function NyttKontoPage() {
  return (
    <div className="numa-page numa-page-wide space-y-6 pt-2 text-[var(--numa-ink)]">
      <header className="space-y-2">
        <Link href="/konton" className="text-sm font-medium text-[var(--numa-muted)]">
          ← Saldo
        </Link>
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">
          Nytt saldo
        </h1>
        <p className="text-[15px] leading-relaxed text-[var(--numa-muted)]">
          Ingen bankkoppling. Ange hur mycket du har just nu — det blir
          startpunkten tills nästa intäkt.
        </p>
      </header>
      <CreateAccountForm />
    </div>
  );
}
