import type { MonthKey } from "@/domain/finance";
import { shiftMonthKey } from "@/domain/finance";

export function MonthNav({
  monthKey,
  label,
  basePath,
}: {
  monthKey: MonthKey;
  label: string;
  basePath: string;
}) {
  const prev = shiftMonthKey(monthKey, -1);
  const next = shiftMonthKey(monthKey, 1);

  return (
    <div className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-2 py-2">
      <a
        href={`${basePath}?m=${prev}`}
        className="flex h-11 w-11 items-center justify-center rounded-xl text-lg text-[var(--numa-accent)]"
        aria-label="Föregående månad"
      >
        ←
      </a>
      <div className="text-center">
        <p className="text-sm font-semibold text-[var(--numa-ink)]">{label}</p>
        <p className="text-[11px] text-[var(--numa-faint)]">Bläddra månad</p>
      </div>
      <a
        href={`${basePath}?m=${next}`}
        className="flex h-11 w-11 items-center justify-center rounded-xl text-lg text-[var(--numa-accent)]"
        aria-label="Nästa månad"
      >
        →
      </a>
    </div>
  );
}
