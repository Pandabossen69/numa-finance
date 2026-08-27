import { CreateUserForm } from "@/components/admin/CreateUserForm";
import { MerBackLink } from "@/components/mer/MerHub";
import { requireNumaAdminOrNotFound } from "@/features/auth/session";

export const dynamic = "force-dynamic";

export default async function NyAnvandarePage() {
  await requireNumaAdminOrNotFound();

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 text-[var(--numa-ink)] md:pt-2">
      <MerBackLink href="/installningar" label="Inställningar" />
      <article className="numa-panel-strong space-y-6 p-5 md:p-8">
        <header className="space-y-2">
          <h1 className="numa-page-title">Ny användare</h1>
          <p className="max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
            Personen loggar in med e-post och lösenord. Första gången sätter hen
            saldo — inte en tom Hem.
          </p>
        </header>
        <CreateUserForm />
      </article>
    </div>
  );
}
