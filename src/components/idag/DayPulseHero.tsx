import { formatMoney, money, type CurrencyCode } from "@/domain/money";
import type { DayPulse } from "@/domain/gamification";

export function DayPulseHero({
  pulse,
  currency,
}: {
  pulse: DayPulse;
  currency: CurrencyCode;
}) {
  const headline =
    pulse.status === "plus"
      ? "Plus idag"
      : pulse.status === "minus"
        ? "Minus idag"
        : "På planen";

  const sub =
    pulse.status === "plus"
      ? `${formatMoney(money(Math.abs(pulse.delta.amountMinor), currency))} kvar av dagens plan`
      : pulse.status === "minus"
        ? `${formatMoney(money(Math.abs(pulse.delta.amountMinor), currency))} över dagens plan`
        : "Du ligger exakt på dagens plan";

  const barWidth = Math.min(100, pulse.usedPercent);
  const over = pulse.usedPercent > 100;

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-[var(--numa-border)] bg-[var(--numa-surface-solid)] px-5 py-5 shadow-[var(--numa-shadow)]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            pulse.status === "plus"
              ? "radial-gradient(600px 220px at 10% 0%, color-mix(in srgb, var(--numa-positive) 14%, transparent), transparent 60%)"
              : pulse.status === "minus"
                ? "radial-gradient(600px 220px at 10% 0%, color-mix(in srgb, var(--numa-danger) 12%, transparent), transparent 60%)"
                : "radial-gradient(600px 220px at 10% 0%, color-mix(in srgb, var(--numa-accent) 12%, transparent), transparent 60%)",
        }}
        aria-hidden
      />

      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--numa-faint)]">
              Dagens läge
            </p>
            <p
              className={`mt-2 text-[1.85rem] font-semibold tracking-tight ${
                pulse.status === "plus"
                  ? "text-[var(--numa-positive)]"
                  : pulse.status === "minus"
                    ? "text-[var(--numa-danger)]"
                    : "text-[var(--numa-ink)]"
              }`}
            >
              {headline}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--numa-muted)]">{sub}</p>
          </div>
          <div className="text-right">
            <p className="money text-lg font-semibold">
              {formatMoney(money(pulse.spentToday.amountMinor, currency))}
            </p>
            <p className="text-xs text-[var(--numa-faint)]">spenderat idag</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-2.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--numa-ink)_8%,transparent)]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                over
                  ? "bg-[var(--numa-danger)]"
                  : pulse.status === "plus"
                    ? "bg-[var(--numa-positive)]"
                    : "bg-[var(--numa-accent)]"
              }`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-[var(--numa-faint)]">
            <span>{pulse.usedPercent}% av dagens plan</span>
            <span className="money">
              plan {formatMoney(money(pulse.plannedToday.amountMinor, currency))}
            </span>
          </div>
        </div>

        {pulse.status === "minus" ? (
          <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
            Ingen katastrof — kommande dagar justeras automatiskt. Fota nästa
            kvitto så håller du koll utan stress.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
            Fota kvitto eller tryck + — läget uppdateras direkt.
          </p>
        )}
      </div>
    </section>
  );
}
