import type { ReactNode, Ref } from "react";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import type { CurrencyCode } from "@/domain/money";

export function PlanCard({
  title,
  hint,
  banner,
  totalLabel,
  totalMinor,
  currency,
  children,
  cardRef,
}: {
  title: string;
  hint?: string;
  banner?: string | null;
  totalLabel: string;
  totalMinor: number;
  currency: CurrencyCode;
  children: ReactNode;
  cardRef?: Ref<HTMLElement>;
}) {
  return (
    <section
      ref={cardRef}
      className="numa-panel flex scroll-mt-[5.5rem] flex-col gap-4 p-6"
    >
      {banner ? (
        <p className="rounded-[1.15rem] bg-[var(--numa-accent-soft)] px-4 py-3 text-sm leading-relaxed text-[var(--numa-accent-ink)]">
          {banner}
        </p>
      ) : null}
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {hint ? (
            <p className="mt-0.5 text-sm text-[var(--numa-muted)]">{hint}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="numa-section-title">{totalLabel}</p>
          <div className="mt-0.5 text-[var(--numa-ink)]">
            <MoneyDisplay
              amountMinor={totalMinor}
              currency={currency}
              size="md"
              compact
              align="end"
              wrap={false}
            />
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4">{children}</div>
    </section>
  );
}
