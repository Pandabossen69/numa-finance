import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { getProfile } from "@/lib/store/repository";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function InstallningarPage() {
  const profile = await getProfile();
  const supabaseReady = isSupabaseConfigured();

  return (
    <div className="space-y-6 pt-2">
      <header>
        <Link href="/mer" className="text-sm text-[var(--numa-muted)]">
          ← Mer
        </Link>
        <h1 className="mt-3 text-[1.65rem] font-semibold tracking-[-0.04em]">
          Inställningar
        </h1>
      </header>

      <dl className="space-y-4 border-y border-[var(--numa-border)] py-4">
        <Row label="Tidszon" value={profile.timezone} />
        <Row label="Primär valuta" value={profile.primaryCurrency} />
        <Row label="Referensvaluta" value={profile.referenceCurrency} />
        <Row
          label="Dataläge"
          value={supabaseReady ? "Supabase (schema numa)" : "Lokal lagring"}
        />
      </dl>

      {supabaseReady ? <SignOutButton /> : null}

      <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
        Teman följer systemets ljus/mörkt. PWA kan installeras från webbläsarens
        “Lägg till på hemskärmen”.
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
