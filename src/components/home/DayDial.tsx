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
    <div
      className={[
        "numa-day-dial relative mx-auto aspect-square w-full max-w-[min(15.5rem,100%)] md:max-w-[17.5rem]",
        over ? "is-over" : null,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <svg
        className="absolute inset-0 h-full w-full -rotate-90"
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
      >
        <defs>
          <linearGradient id="numa-dial-mint" x1="24" y1="18" x2="196" y2="202">
            <stop offset="0" stopColor="#55bfa1" />
            <stop offset="0.42" stopColor="var(--numa-accent)" />
            <stop offset="1" stopColor="#0a5948" />
          </linearGradient>
          <linearGradient id="numa-dial-clay" x1="24" y1="18" x2="196" y2="202">
            <stop offset="0" stopColor="#d9a06d" />
            <stop offset="0.52" stopColor="var(--numa-alarm)" />
            <stop offset="1" stopColor="#7f4c2d" />
          </linearGradient>
          <radialGradient id="numa-dial-core" cx="36%" cy="25%" r="76%">
            <stop
              offset="0"
              stopColor={over ? "rgba(255,245,233,0.92)" : "rgba(255,252,239,0.96)"}
            />
            <stop
              offset="1"
              stopColor={over ? "rgba(246,228,208,0.6)" : "rgba(213,240,230,0.46)"}
            />
          </radialGradient>
        </defs>
        <circle
          className="is-core"
          cx={size / 2}
          cy={size / 2}
          r={r - 10}
          fill="url(#numa-dial-core)"
        />
        <circle
          className="is-track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? "url(#numa-dial-clay)" : "rgba(18,122,98,0.14)"}
          opacity={over ? 0.52 : 1}
          strokeWidth={stroke}
        />
        {filled > 0 ? (
          <>
            <circle
              className="is-arc-halo"
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={over ? "rgba(168,107,58,0.2)" : "rgba(18,122,98,0.18)"}
              strokeWidth={stroke + 6}
              strokeLinecap={remainRatio >= 0.995 ? "butt" : "round"}
              strokeDasharray={`${filled} ${track}`}
            />
            <circle
              className="numa-day-dial-arc"
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={over ? "url(#numa-dial-clay)" : "url(#numa-dial-mint)"}
              strokeWidth={stroke}
              strokeLinecap={remainRatio >= 0.995 ? "butt" : "round"}
              strokeDasharray={`${filled} ${track}`}
              style={{
                ["--numa-dial-len" as string]: String(filled),
                ["--numa-dial-track" as string]: String(track),
              }}
            />
          </>
        ) : null}
        <circle
          className="is-inner-line"
          cx={size / 2}
          cy={size / 2}
          r={r - 15}
          fill="none"
          stroke="rgba(255,255,255,0.68)"
          strokeWidth="1"
        />
      </svg>
      <div className="absolute inset-[10%] flex min-w-0 flex-col items-center justify-center overflow-visible px-2 text-center">
        {children}
      </div>
    </div>
  );
}
