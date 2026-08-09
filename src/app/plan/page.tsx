export default function PlanPage() {
  return (
    <div className="animate-rise space-y-6 pt-2">
      <header>
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">Plan</h1>
        <p className="mt-2 max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          Här samlas det som måste betalas, vardag, flexibelt, mål och buffert.
        </p>
      </header>

      <ul className="space-y-4">
        {[
          { title: "Måste betalas", body: "Hyra, räkningar och andra fasta kostnader." },
          { title: "Vardag", body: "Mat, transport och det du räknar med varje månad." },
          { title: "Flexibelt", body: "Shopping och övrigt som kan flyttas." },
          { title: "Mål", body: "Sparande och planerade köp." },
          { title: "Buffert", body: "Säkerhetsmarginal som inte ska räknas som ledigt." },
        ].map((item) => (
          <li key={item.title} className="border-t border-[var(--numa-border)] pt-4">
            <h2 className="font-medium">{item.title}</h2>
            <p className="mt-1 text-sm text-[var(--numa-muted)]">{item.body}</p>
          </li>
        ))}
      </ul>

      <p className="text-sm text-[var(--numa-faint)]">
        Planmotorn byggs i fas 1. Idag räknas tryggt att spendera utan reserver.
      </p>
    </div>
  );
}
