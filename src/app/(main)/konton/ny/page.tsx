import { CreateAccountForm } from "@/components/accounts/CreateAccountForm";
import { MerBackLink } from "@/components/mer/MerHub";
import { getProfile } from "@/lib/store/repository";

export default async function NyttKontoPage() {
  const profile = await getProfile();

  return (
    <div className="numa-page numa-page-wide space-y-6 pt-2 text-[var(--numa-ink)]">
      <header className="space-y-2">
        <MerBackLink href="/konton" label="Saldo" />
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">
          Nytt saldo
        </h1>
        <p className="text-[15px] leading-relaxed text-[var(--numa-muted)]">
          Ingen bankkoppling. Ange hur mycket du har just nu — det blir
          startpunkten tills nästa intäkt.
        </p>
      </header>
      <CreateAccountForm primaryCurrency={profile.primaryCurrency} />
    </div>
  );
}
