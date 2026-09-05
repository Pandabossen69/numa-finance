import { notFound } from "next/navigation";
import { ManageAccountForm } from "@/components/accounts/ManageAccountForm";
import { MerBackLink } from "@/components/mer/MerHub";
import { loadAccountDetail } from "@/features/finance/load-account-detail";

export const dynamic = "force-dynamic";

export default async function KontoDetaljPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadAccountDetail(id);
  if (!result.ok && result.notFound) notFound();

  return (
    <div className="numa-page numa-page-wide min-w-0 overflow-x-hidden space-y-6 pt-2 text-[var(--numa-ink)]">
      <header className="space-y-2">
        <MerBackLink href="/konton" label="Konton" />
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">
          {result.ok ? result.data.name : "Konto"}
        </h1>
        <p className="text-[15px] leading-relaxed text-[var(--numa-muted)]">
          {result.ok && !result.data.isActive
            ? "Arkiverat konto. Historiken är kvar."
            : "Ändra namn och typ, eller arkivera och radera."}
        </p>
      </header>
      {result.ok ? (
        <ManageAccountForm account={result.data} />
      ) : (
        <p className="text-sm text-[var(--numa-danger)]" role="alert">
          {result.error}
        </p>
      )}
    </div>
  );
}
