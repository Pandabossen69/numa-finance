import { CreateUserForm } from "@/components/admin/CreateUserForm";
import { MerPageHeader } from "@/components/mer/MerHub";
import { requireNumaAdminOrNotFound } from "@/features/auth/session";

export const dynamic = "force-dynamic";

export default async function NyAnvandarePage() {
  await requireNumaAdminOrNotFound();

  return (
    <div className="numa-page numa-page-wide space-y-6 text-[var(--numa-ink)]">
      <MerPageHeader
        back
        title="Ny användare"
        description="Skapa ett konto. Personen loggar in med e-post och lösenord. Allt börjar tomt — ingen plan, inga konton, inga transaktioner."
      />
      <CreateUserForm />
    </div>
  );
}
