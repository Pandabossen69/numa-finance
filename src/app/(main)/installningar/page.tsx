import { SignOutButton } from "@/components/auth/SignOutButton";
import { RepairAppButton } from "@/components/pwa/RepairAppButton";
import { getProfile } from "@/lib/store/repository";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function InstallningarPage({
  searchParams,
}: {
  searchParams: Promise<{ laga?: string }>;
}) {
  const params = await searchParams;
  const autoLaga = params.laga === "1";

  let profile: Awaited<ReturnType<typeof getProfile>> | null = null;
  try {
    profile = await getProfile();
  } catch (error) {
    console.error("[numa] installningar failed", error);
  }
  const supabaseReady = isSupabaseConfigured();

  return (
    <div className="space-y-6 pt-2 text-[var(--numa-ink)]">
      <header>
        <a href="/mer" className="text-sm text-[var(--numa-muted)]">
          ← Mer
        </a>
        <h1 className="mt-3 text-[1.65rem] font-semibold tracking-[-0.04em]">
          Inställningar
        </h1>
      </header>

      <section className="space-y-3 rounded-[1.35rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-4 py-4">
        <h2 className="text-base font-semibold">Fungerar inte appen?</h2>
        <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
          Om Idag är tom vit medan menyn syns beror det oftast på gammal cache i
          telefonen. Tryck knappen — den rensar och laddar om.
        </p>
        <RepairAppButton autoStart={autoLaga} />
      </section>

      {profile ? (
        <dl className="space-y-4 border-y border-[var(--numa-border)] py-4">
          <Row label="Tidszon" value={profile.timezone} />
          <Row label="Primär valuta" value={profile.primaryCurrency} />
          <Row label="Referensvaluta" value={profile.referenceCurrency} />
          <Row
            label="Dataläge"
            value={supabaseReady ? "Supabase (schema numa)" : "Lokal lagring"}
          />
        </dl>
      ) : (
        <p className="text-sm text-[var(--numa-muted)]">
          Kunde inte läsa profilen. Prova “Laga appen” ovan.
        </p>
      )}

      {supabaseReady ? <SignOutButton /> : null}
    </div>
  );
}

function Row({ label: rowLabel, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--numa-faint)]">
        {rowLabel}
      </dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}
