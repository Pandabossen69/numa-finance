import Link from "next/link";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { PlanEditor } from "@/components/plan/PlanEditor";
import { formatMoney, moneyFromUnknown } from "@/domain/money";
import { safeLoadTodaySnapshot } from "@/lib/store/load-snapshot";

export default async function PlanPage() {
  const loaded = await safeLoadTodaySnapshot();
  if (!loaded.ok) {
    return (
      <div className="space-y-4 pt-6 text-[var(--numa-ink)]">
        <h1 className="text-2xl font-semibold tracking-tight">
          Kunde inte ladda plan
        </h1>
        <p className="text-sm text-[var(--numa-muted)]">
          Ladda om sidan. Om det kvarstår, logga ut och in igen.
        </p>
        <a
          href="/idag"
          className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[var(--numa-accent)] px-5 text-sm font-semibold text-white"
        >
          Till Idag
        </a>
      </div>
    );
  }
  const snap = loaded.snap;

  if (!snap.primaryAccount) {
    return (
      <div className="space-y-5 pt-2 text-[var(--numa-ink)]">
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">Plan</h1>
        <p className="max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          När du angett ditt saldo kan du lägga in det som redan är öronmärkt —
          då blir tryggt idag ärligt.
        </p>
        <Link
          href="/idag"
          className="text-sm font-medium text-[var(--numa-accent)]"
        >
          Ange mitt saldo →
        </Link>
      </div>
    );
  }

  const reservedPaidDown =
    snap.reservedPlannedMinor > 0 &&
    snap.reservedMinor < snap.reservedPlannedMinor;

  const summary = [
    {
      title: "Tryggt idag",
      body: "Efter det som fortfarande är öronmärkt + buffert, spritt till nästa inkomst.",
      amount: snap.safeToSpendTodayMinor,
    },
    {
      title: reservedPaidDown ? "Kvar att reservera" : "Reserverat",
      body: reservedPaidDown
        ? `Av ${formatMoney(moneyFromUnknown(snap.reservedPlannedMinor, snap.currency))} i planen — det du redan betalat räknas bort.`
        : "Måste, vardag och mål som fortfarande väntar.",
      amount: snap.reservedMinor,
    },
    {
      title: "Buffert",
      body: "Säkerhetsmarginal som inte räknas som ledigt.",
      amount: snap.bufferMinor,
    },
    {
      title: "Flex kvar",
      body: "Kan begränsa hur mycket som får användas per dag.",
      amount: snap.flexibleMinor,
    },
  ];

  return (
    <div className="space-y-8 pt-2 pb-4 text-[var(--numa-ink)]">
      <header>
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">Plan</h1>
        <p className="mt-2 max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          Lägg in det som redan är öronmärkt. När du betalar det via + räknas det
          bort automatiskt från tryggt idag.
        </p>
      </header>

      <ul className="space-y-4">
        {summary.map((item) => (
          <li
            key={item.title}
            className="border-t border-[var(--numa-border)] pt-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-medium">{item.title}</h2>
                <p className="mt-1 text-sm text-[var(--numa-muted)]">
                  {item.body}
                </p>
              </div>
              <MoneyDisplay
                amountMinor={item.amount}
                currency={snap.currency}
                size="md"
                compact
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="text-sm text-[var(--numa-muted)]">
        {snap.daysUntilIncome} dagar till nästa inkomst i beräkningen.
      </p>

      <PlanEditor
        items={snap.planItems}
        currency={snap.currency}
        daysUntilIncome={snap.daysUntilIncome}
        itemRemaining={snap.planItemRemaining}
      />
    </div>
  );
}
