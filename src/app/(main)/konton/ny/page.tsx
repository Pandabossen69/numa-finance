import { CreateAccountForm } from "@/components/accounts/CreateAccountForm";
import { MerBackLink } from "@/components/mer/MerHub";
import { getProfile } from "@/lib/store/repository";

export default async function NyttKontoPage() {
  const profile = await getProfile();

  return (
    <div className="numa-page numa-page-wide min-w-0 overflow-x-hidden space-y-6 pt-2 text-[var(--numa-ink)]">
      <header className="space-y-2">
        <MerBackLink href="/konton" label="Konton" />
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">
          Nytt konto
        </h1>
        <p className="text-[15px] leading-relaxed text-[var(--numa-muted)]">
          Välj typ och belopp. Hem och Plan räknar alltid ihop allt till THB.
        </p>
      </header>
      <CreateAccountForm primaryCurrency={profile.primaryCurrency} />
    </div>
  );
}
