import Link from "next/link";
import { ImportScreenshotButton } from "@/components/imports/ImportScreenshotButton";
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
          Importera skärmbild
        </h1>
        <p className="mt-2 max-w-[38ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          En skärmbild är en observation — inte en transaktion. Den kan innehålla
          flera kandidater som granskas innan något blir kanoniskt.
        </p>
      </header>

      <section className="space-y-3 rounded-3xl border border-[var(--numa-border)] bg-[var(--numa-surface)] px-4 py-5">
        <p className="text-sm font-medium">OCR är inte inkopplad ännu</p>
        <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
          Fas 0 sparar importpunkten och observationsmodellen. När vision/OCR
          kopplas in går flödet via kandidater, validering, dubblettkontroll och
          eventuell granskning — aldrig direkt till huvudboken.
        </p>
        <ImportScreenshotButton />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-[var(--numa-muted)]">
          Observationer
        </h2>
        {observations.length === 0 ? (
          <p className="text-sm text-[var(--numa-muted)]">Inga ännu.</p>
        ) : (
          <ul className="divide-y divide-[var(--numa-border)] border-y border-[var(--numa-border)]">
            {observations.map((o) => (
              <li key={o.id} className="py-3">
                <p className="text-sm font-medium">
                  {o.institutionHint ?? "Observation"} · {statusLabel(o.status)}
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

function statusLabel(status: string): string {
  switch (status) {
    case "uploaded":
      return "Mottagen";
    case "needs_review":
      return "Behöver kontrolleras";
    case "processed":
      return "Klar";
    default:
      return status;
  }
}
