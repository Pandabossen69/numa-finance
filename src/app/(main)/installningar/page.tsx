import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { RepairAppButton } from "@/components/pwa/RepairAppButton";
import { getProfile } from "@/lib/store/repository";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function InstallningarPage() {
  let profile: Awaited<ReturnType<typeof getProfile>> | null = null;
  try {
    profile = await getProfile();
  } catch (error) {
    console.error("[numa] installningar profile failed", error);
  }
  const supabaseReady = isSupabaseConfigured();

  return (
    <div className="space-y-6 pt-2 text-[var(--numa-ink)]">
      <header>
        <Link href="/mer" className="text-sm text-[var(--numa-muted)]">
          ← Mer
        </Link>
        <h1 className="mt-3 text-[1.65rem] font-semibold tracking-[-0.04em]">
          Inställningar
        </h1>
      </header>

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
          Kunde inte läsa profilen. Prova “Laga appen” nedan.
        </p>
      )}

      <RepairAppButton />

      {supabaseReady ? <SignOutButton /> : null}

      <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
        Teman följer systemets ljus/mörkt. Offline-PWA är tillfälligt avstängd
        efter en cache-bugg — öppna via Safari/Chrome tills vidare.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--numa-faint)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}
