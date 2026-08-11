import Link from "next/link";

const links = [
  {
    href: "/transaktioner",
    label: "Rörelser",
    hint: "Kvitton, SMS och manuella belopp",
  },
  { href: "/konton", label: "Saldo", hint: "Verifiera hur mycket du har" },
  { href: "/fota", label: "Fota", hint: "Bank-SMS eller kvitto" },
  { href: "/importera", label: "Importer", hint: "Tidigare observationer" },
  { href: "/installningar", label: "Inställningar", hint: "Tidszon & underhåll" },
  { href: "/laga", label: "Laga appen", hint: "Rensa cache om något strular" },
] as const;

export default function MerPage() {
  return (
    <div className="space-y-6">
      <header className="animate-rise">
        <h1 className="text-3xl font-semibold tracking-tight">Mer</h1>
        <p className="mt-2 text-sm text-[var(--numa-muted)]">
          Saldo, historik och underhåll.
        </p>
      </header>

      <nav className="animate-rise-delay-1 space-y-2" aria-label="Mer-meny">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            prefetch
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
          </Link>
        ))}
      </nav>
    </div>
  );
}
