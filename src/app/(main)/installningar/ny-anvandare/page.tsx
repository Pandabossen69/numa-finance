import { CreateUserForm } from "@/components/admin/CreateUserForm";
import { MerPageHeader } from "@/components/mer/MerHub";
import { requireNumaAdminOrNotFound } from "@/features/auth/session";

export const dynamic = "force-dynamic";

export default async function NyAnvandarePage() {
  await requireNumaAdminOrNotFound();

  return (
    <div className="numa-page mx-auto w-full max-w-lg space-y-6 text-[var(--numa-ink)] md:pt-4">
      <MerPageHeader
        back
        title="Ny användare"
        description="Personen loggar in med e-post och lösenord. Första gången sätter hen saldo — inte en tom Hem."
      />
      <CreateUserForm />
    </div>
  );
}
