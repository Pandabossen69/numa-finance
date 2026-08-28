/**
 * Day dial — remaining dagsbudget as a living ring.
 * Full green when nothing is spent; the arc depletes as the day is used.
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
  const stroke = 8;
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  const remainRatio = over ? 0 : Math.max(0, 1 - Math.min(1, usedRatio));
  const filled = remainRatio >= 0.995 ? c : remainRatio * c;
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
          r={r - 10}
          fill={over ? "rgba(168,107,58,0.08)" : "rgba(18,122,98,0.08)"}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? "rgba(168,107,58,0.28)" : "rgba(18,122,98,0.2)"}
          strokeWidth={stroke}
        />
        {filled > 0 ? (
          <circle
            className="numa-day-dial-arc"
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={over ? "var(--numa-alarm)" : "var(--numa-accent)"}
            strokeWidth={stroke}
            strokeLinecap={remainRatio >= 0.995 ? "butt" : "round"}
            strokeDasharray={`${filled} ${track}`}
            style={
              {
                ["--numa-dial-len" as string]: String(filled),
                ["--numa-dial-track" as string]: String(track),
              }
            }
          />
        ) : null}
      </svg>
      <div className="absolute inset-[10%] flex flex-col items-center justify-center overflow-visible px-2 text-center">
        {children}
      </div>
    </div>
  );
}
