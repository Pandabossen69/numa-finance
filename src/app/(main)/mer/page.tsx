import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { listObservations } from "@/lib/store/repository";

const links = [
  { href: "/konton", label: "Mina saldon" },
  { href: "/transaktioner", label: "Rörelser (månad för månad)" },
  { href: "/lagg-till", label: "Lägg till (manuellt / import)" },
  { href: "/bank-sms", label: "Importera bank-SMS" },
  { href: "/fota", label: "Fota kvitto" },
  { href: "/importera", label: "Importer" },
  { href: "/installningar", label: "Inställningar" },
] as const;

export default async function MerPage() {
  let observations: Awaited<ReturnType<typeof listObservations>> = [];
  try {
    observations = await listObservations();
  } catch (error) {
    console.error("[numa] mer observations failed", error);
  }
  const supabaseReady = isSupabaseConfigured();

  return (
    <div className="space-y-6 pt-2 text-[var(--numa-ink)]">
      <header>
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">Mer</h1>
        <p className="mt-2 text-sm text-[var(--numa-muted)]">
          Saldon, historik och snabb import.
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
        <h2 className="text-sm font-medium text-[var(--numa-muted)]">Läge</h2>
        <p className="text-sm text-[var(--numa-muted)]">
          {supabaseReady
            ? "Molnkonto aktivt — din data är privat per inloggning."
            : "Lokalt läge (en användare) — koppla Supabase för flera konton."}
        </p>
        <p className="text-sm text-[var(--numa-muted)]">
          Sparade bilder: {observations.length}
        </p>
      </section>
    </div>
  );
}
