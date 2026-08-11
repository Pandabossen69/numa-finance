import Link from "next/link";

const links = [
  {
    href: "/transaktioner",
    label: "Rörelser",
    hint: "SMS, kvitton och manuella belopp",
  },
  { href: "/konton", label: "Saldo", hint: "Bankens sanning · checkpoint" },
  { href: "/fota", label: "Lägg till", hint: "Fota bank-SMS eller kvitto" },
  { href: "/importera", label: "Importer", hint: "Tidigare observationer" },
  {
    href: "/installningar",
    label: "Inställningar",
    hint: "Tidszon och underhåll",
  },
  { href: "/laga", label: "Laga appen", hint: "Rensa cache om något strular" },
] as const;

export default function MerPage() {
  return (
    <div className="mx-auto max-w-lg space-y-8">
      <header className="animate-rise">
        <h1 className="text-3xl font-semibold tracking-tight">Mer</h1>
        <p className="mt-2 max-w-[34ch] text-sm text-[var(--numa-muted)]">
          Saldo, historik och underhåll — allt som håller Hem skarp.
        </p>
      </header>

      <nav
        className="animate-rise-delay-1 divide-y divide-[var(--numa-border)] border-y border-[var(--numa-border)]"
        aria-label="Mer-meny"
      >
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            prefetch
            className="group flex items-center justify-between gap-4 py-4 transition hover:bg-white/40"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold tracking-tight text-[var(--numa-ink)]">
                {link.label}
              </span>
              <span className="mt-0.5 block text-xs text-[var(--numa-faint)]">
                {link.hint}
              </span>
            </span>
            <span
              className="shrink-0 text-[var(--numa-faint)] transition group-hover:translate-x-0.5 group-hover:text-[var(--numa-accent)]"
              aria-hidden
            >
              →
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
