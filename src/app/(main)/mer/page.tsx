import { isSupabaseConfigured } from "@/lib/supabase/config";

const links = [
  { href: "/transaktioner", label: "Utgifter & intäkter", hint: "Totalt in, ut och vad som blir över" },
  { href: "/konton", label: "Mina saldon", hint: "Konton & verifiering" },
  { href: "/fota", label: "Fota kvitto / skärmbild", hint: "Bank-SMS och kvitton" },
  { href: "/importera", label: "Importer", hint: "Bankobservationer" },
  { href: "/installningar", label: "Inställningar", hint: "Valuta & tidszon" },
  { href: "/laga", label: "Laga appen", hint: "Rensa cache / SW" },
] as const;

export default function MerPage() {
  const supabaseReady = isSupabaseConfigured();

  return (
    <div className="space-y-6">
      <header className="animate-rise">
        <h1 className="text-3xl font-semibold tracking-tight">Mer</h1>
        <p className="mt-2 text-sm text-[var(--numa-muted)]">
          Saldon, historik och underhåll.
        </p>
      </header>

      <div
        className={`animate-rise-delay-1 rounded-2xl px-4 py-3 text-sm font-medium ${
          supabaseReady
            ? "bg-[var(--numa-positive-soft)] text-[var(--numa-positive)]"
            : "bg-[var(--numa-warning-soft)] text-[var(--numa-warning)]"
        }`}
      >
        {supabaseReady
          ? "Supabase konfigurerad · schema numa"
          : "Supabase saknas lokalt — mock / lokal store"}
      </div>

      <nav className="animate-rise-delay-2 space-y-2" aria-label="Mer-meny">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="numa-panel flex items-center justify-between gap-3 px-4 py-4 transition hover:bg-white"
          >
            <span>
              <span className="block text-sm font-semibold text-[var(--numa-ink)]">
                {link.label}
              </span>
              <span className="mt-0.5 block text-xs text-[var(--numa-faint)]">
                {link.hint}
              </span>
            </span>
            <span className="text-[var(--numa-faint)]" aria-hidden>
              →
            </span>
          </a>
        ))}
      </nav>
    </div>
  );
}
