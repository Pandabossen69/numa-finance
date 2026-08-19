/**
 * Day dial — the visual metaphor for sticky dagsbudget.
 * The ring fills as you spend; remaining money sits in the center.
 */
export function DayDial({
  usedRatio,
  over = false,
  children,
}: {
  /** 0 = nothing spent, 1 = full day budget used. */
  usedRatio: number;
  over?: boolean;
  children: React.ReactNode;
}) {
  const size = 220;
  const stroke = 7;
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1.08, Math.max(0, usedRatio));
  const filled = Math.min(1, clamped) * c;
  const track = c;

  return (
    <div className="numa-day-dial relative mx-auto aspect-square w-full max-w-[15.5rem] md:max-w-[17.5rem]">
      <svg
        className="absolute inset-0 h-full w-full -rotate-90"
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(10,26,20,0.06)"
          strokeWidth={stroke}
        />
        <circle
          className="numa-day-dial-arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? "var(--numa-danger)" : "var(--numa-accent)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${track}`}
          style={
            {
              ["--numa-dial-len" as string]: String(filled),
              ["--numa-dial-track" as string]: String(track),
            }
          }
        />
      </svg>
      <div className="absolute inset-[10%] flex flex-col items-center justify-center overflow-visible px-2 text-center">
        {children}
      </div>
    </div>
  );
}
