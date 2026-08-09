import Link from "next/link";
import { listObservations } from "@/lib/store/repository";

export default async function ImporteraPage() {
  const observations = await listObservations();

  return (
    <div className="space-y-6 pt-2">
      <header>
        <Link href="/mer" className="text-sm text-[var(--numa-muted)]">
          ← Mer
        </Link>
        <h1 className="mt-3 text-[1.65rem] font-semibold tracking-[-0.04em]">
          Importer
        </h1>
        <p className="mt-2 max-w-[38ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          Här sparas bilder du lagt in. Inget blir en utgift förrän du
          bekräftar beloppet.
        </p>
      </header>

      <Link
        href="/fota"
        className="flex min-h-14 flex-col justify-center rounded-[1.25rem] bg-[var(--numa-accent)] px-4 text-white"
      >
        <span className="text-[15px] font-semibold">Fota nytt kvitto</span>
        <span className="text-xs text-white/80">Snabbaste vägen in i NUMA</span>
      </Link>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-[var(--numa-muted)]">
          Senaste
        </h2>
        {observations.length === 0 ? (
          <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
            Inga bilder ännu. Tryck på knappen ovan när du är i kassan.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--numa-border)] border-y border-[var(--numa-border)]">
            {observations.map((o) => (
              <li key={o.id} className="py-3">
                <p className="text-sm font-medium">
                  {kindLabel(o.kind)} · {statusLabel(o.status)}
                </p>
                <p className="mt-1 text-xs text-[var(--numa-faint)]">
                  {new Date(o.createdAt).toLocaleString("sv-SE")}
                </p>
                {o.notes ? (
                  <p className="mt-2 text-sm text-[var(--numa-muted)]">{o.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function kindLabel(kind: string): string {
  switch (kind) {
    case "receipt":
      return "Kvitto";
    case "screenshot":
      return "Skärmbild";
    case "price":
      return "Pris";
    default:
      return "Bild";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "uploaded":
      return "Mottagen";
    case "extracting":
      return "Läser";
    case "needs_review":
      return "Väntar på dig";
    case "processed":
      return "Sparad";
    case "failed":
      return "Kunde inte läsas";
    default:
      return status;
  }
}
