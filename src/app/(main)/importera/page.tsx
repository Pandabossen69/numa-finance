import {
  MerListGroup,
  MerListLink,
  MerListRow,
  MerPageHeader,
  MerSection,
} from "@/components/mer/MerHub";
import { listObservations } from "@/lib/store/repository";

export default async function ImporteraPage() {
  const observations = await listObservations();

  return (
    <div className="mx-auto max-w-lg space-y-7">
      <MerPageHeader back title="Tidigare bilder" />

      <div className="animate-rise-delay-1 space-y-6">
        <MerSection>
          <MerListGroup>
            <MerListLink href="/fota" label="Lägg till SMS eller kvitto" />
          </MerListGroup>
        </MerSection>

        <MerSection title="Senaste">
          {observations.length === 0 ? (
            <MerListGroup>
              <MerListRow>
                <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
                  Inga bilder ännu.
                </p>
              </MerListRow>
            </MerListGroup>
          ) : (
            <MerListGroup>
              {observations.map((o) => {
                const status = statusMeta(o.status);
                return (
                  <MerListRow key={o.id} className="space-y-1.5 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[15px] font-medium tracking-tight text-[var(--numa-ink)]">
                        {kindLabel(o.kind)}
                      </p>
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <p className="text-[12px] text-[var(--numa-faint)]">
                      {new Date(o.createdAt).toLocaleString("sv-SE")}
                    </p>
                    {o.notes ? (
                      <p className="text-sm leading-snug text-[var(--numa-muted)]">
                        {o.notes}
                      </p>
                    ) : null}
                  </MerListRow>
                );
              })}
            </MerListGroup>
          )}
        </MerSection>
      </div>
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

function statusMeta(status: string): { label: string; className: string } {
  switch (status) {
    case "uploaded":
      return {
        label: "Mottagen",
        className: "bg-[var(--numa-accent-soft)] text-[var(--numa-accent-ink)]",
      };
    case "extracting":
      return {
        label: "Läser",
        className: "bg-[var(--numa-warning-soft)] text-[var(--numa-warning)]",
      };
    case "needs_review":
      return {
        label: "Väntar på dig",
        className: "bg-[var(--numa-warning-soft)] text-[var(--numa-warning)]",
      };
    case "processed":
      return {
        label: "Sparad",
        className: "bg-[var(--numa-positive-soft)] text-[var(--numa-positive)]",
      };
    case "failed":
      return {
        label: "Kunde inte läsas",
        className: "bg-[var(--numa-danger-soft)] text-[var(--numa-danger)]",
      };
    default:
      return {
        label: status,
        className: "bg-[var(--numa-accent-soft)] text-[var(--numa-accent-ink)]",
      };
  }
}
