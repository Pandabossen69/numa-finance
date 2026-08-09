import Link from "next/link";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { PlanEditor } from "@/components/plan/PlanEditor";
import { getTodaySnapshot } from "@/lib/store/repository";

export default async function PlanPage() {
  const snap = await getTodaySnapshot();

  if (!snap.primaryAccount) {
    return (
      <div className="space-y-5 pt-2">
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">Plan</h1>
        <p className="max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          När du angett ditt saldo kan du lägga in hinkar — då blir tryggt idag
          ärligt.
        </p>
        <Link href="/idag" className="text-sm font-medium text-[var(--numa-accent)]">
          Ange mitt saldo →
        </Link>
      </div>
    );
  }

  const summary = [
    {
      title: "Tryggt idag",
      body: "Efter reserver och buffert, spritt till nästa inkomst.",
      amount: snap.safeToSpendTodayMinor,
    },
    {
      title: "Reserverat",
      body: "Måste, vardag och mål som redan är planerade.",
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
    <div className="space-y-8 pt-2 pb-4">
      <header>
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">Plan</h1>
        <p className="mt-2 max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          Lägg in det som redan är öronmärkt. NUMA räknar om tryggt idag direkt.
        </p>
      </header>

      <ul className="space-y-4">
        {summary.map((item) => (
          <li key={item.title} className="border-t border-[var(--numa-border)] pt-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-medium">{item.title}</h2>
                <p className="mt-1 text-sm text-[var(--numa-muted)]">{item.body}</p>
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
      />
    </div>
  );
}
