import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { listObservations } from "@/lib/store/repository";

const links = [
  { href: "/konton", label: "Konton" },
  { href: "/transaktioner", label: "Utgifter & rörelser" },
  { href: "/importera", label: "Importera skärmbild" },
  { href: "/installningar", label: "Inställningar" },
] as const;

export default async function MerPage() {
  const observations = await listObservations();
  const supabaseReady = isSupabaseConfigured();

  return (
    <div className="space-y-6 pt-2">
      <header>
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">Mer</h1>
        <p className="mt-2 text-sm text-[var(--numa-muted)]">
          Konton, historik och import.
        </p>
      </header>

      <nav className="divide-y divide-[var(--numa-border)] border-y border-[var(--numa-border)]">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex min-h-14 items-center justify-between text-sm font-medium"
          >
            {link.label}
            <span className="text-[var(--numa-faint)]" aria-hidden>
              →
            </span>
          </Link>
        ))}
      </nav>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-[var(--numa-muted)]">Status</h2>
        <p className="text-sm text-[var(--numa-muted)]">
          Dataläge: {supabaseReady ? "Supabase · schema numa" : "Lokal lagring (.data)"}
        </p>
        <p className="text-sm text-[var(--numa-muted)]">
          Observationer sparade: {observations.length}
        </p>
      </section>
    </div>
  );
}
