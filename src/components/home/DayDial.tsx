/**
 * Thin remaining bar for today's dagsbudget.
 * Full bar = nothing spent. It shrinks as the day is used. No glow.
 */
export function DayBudgetBar({
  usedRatio,
  over = false,
}: {
  /** 0 = nothing spent, 1 = full day budget used. */
  usedRatio: number;
  over?: boolean;
}) {
  const remainRatio = over ? 0 : Math.max(0, 1 - Math.min(1, usedRatio));
  const width = `${Math.round(remainRatio * 1000) / 10}%`;

  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--numa-dial-track)]"
      aria-hidden
    >
      <div
        className="h-full rounded-full"
        style={{
          width,
          background: over ? "var(--numa-warning)" : "var(--numa-accent)",
        }}
      />
    </div>
  );
}
