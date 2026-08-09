import Link from "next/link";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { formatMoney, money } from "@/domain/money";
import { getTodaySnapshot } from "@/lib/store/repository";

export default async function IdagPage() {
  const snap = await getTodaySnapshot();

  if (!snap.primaryAccount) {
    return (
      <div className="animate-rise space-y-10 pt-6">
        <BrandHeader />
        <section className="space-y-4">
          <h1 className="max-w-[14ch] text-3xl font-semibold tracking-tight">
            Börja med ditt verkliga saldo
          </h1>
          <p className="max-w-[34ch] text-[15px] leading-relaxed text-[var(--numa-muted)]">
            Skapa ett konto och ange ett verifierat saldo. Sedan kan NUMA hålla
            koll på vad som är ledigt att använda.
          </p>
          <Link
            href="/konton/ny"
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[var(--numa-accent)] px-5 text-sm font-medium text-white"
          >
            Skapa konto
          </Link>
        </section>
      </div>
    );
  }

  const balanceLabel =
    snap.balanceKind === "calculated"
      ? "Beräknat från verifierat saldo"
      : snap.balanceKind === "verified_checkpoint_only"
        ? "Verifierat saldo"
        : "Saldo saknas";

  return (
    <div className="animate-rise space-y-8 pt-2">
      <BrandHeader />

      <section className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
          Tillgängligt
        </p>
        <div>
          {snap.calculatedBalanceMinor != null ? (
            <MoneyDisplay
              amountMinor={snap.calculatedBalanceMinor}
              currency={snap.currency}
              size="xl"
            />
          ) : (
            <span className="text-3xl font-semibold">—</span>
          )}
        </div>
        <p className="text-sm text-[var(--numa-muted)]">{balanceLabel}</p>
      </section>

      <section className="space-y-3 border-t border-[var(--numa-border)] pt-6">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
          Tryggt att spendera
        </p>
        <div className="flex items-end justify-between gap-4">
          <div>
            <MoneyDisplay
              amountMinor={snap.safeToSpendTodayMinor}
              currency={snap.currency}
              size="lg"
            />
            <p className="mt-1 text-sm text-[var(--numa-muted)]">idag</p>
          </div>
          <div className="text-right">
            <MoneyDisplay
              amountMinor={snap.safeToSpendWeekMinor}
              currency={snap.currency}
              size="md"
              compact
            />
            <p className="mt-1 text-sm text-[var(--numa-muted)]">denna vecka</p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
          Baserat på tillgängligt saldo över {snap.daysUntilIncome} dagar till
          nästa inkomst. Reserver och buffert läggs till i nästa fas.
        </p>
      </section>

      <section className="space-y-4 border-t border-[var(--numa-border)] pt-6">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
          Den här månaden
        </p>
        <div className="grid grid-cols-2 gap-y-5">
          <Stat label="Spenderat" amount={snap.monthSpendingMinor} currency={snap.currency} />
          <Stat label="Idag" amount={snap.todaySpendingMinor} currency={snap.currency} />
          <Stat label="Reserverat" amount={snap.reservedMinor} currency={snap.currency} />
          <Stat label="Fritt" amount={snap.freeMinor} currency={snap.currency} />
        </div>
        <p className="text-sm text-[var(--numa-positive)]">
          {snap.todaySpendingMinor <= snap.safeToSpendTodayMinor
            ? "På rätt spår"
            : "Över dagens plan — framtida dagsbudget justeras"}
        </p>
      </section>

      <section className="space-y-3 border-t border-[var(--numa-border)] pt-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
            Senaste
          </p>
          <Link href="/transaktioner" className="text-sm text-[var(--numa-accent)]">
            Visa alla
          </Link>
        </div>
        {snap.recentTransactions.length === 0 ? (
          <p className="text-sm text-[var(--numa-muted)]">
            Inga utgifter ännu. Tryck + för att lägga till.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--numa-border)]">
            {snap.recentTransactions.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{tx.description}</p>
                  <p className="text-xs text-[var(--numa-faint)]">
                    {tx.category ?? typeLabel(tx.transactionType)} ·{" "}
                    {syncLabel(tx.syncStatus)}
                  </p>
                </div>
                <span
                  className={`money shrink-0 text-sm font-semibold ${
                    tx.direction === "debit"
                      ? "text-[var(--numa-ink)]"
                      : "text-[var(--numa-positive)]"
                  }`}
                >
                  {tx.direction === "debit" ? "−" : "+"}
                  {formatMoney(money(tx.amountMinor, tx.currency))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2 border-t border-[var(--numa-border)] pt-6 pb-4">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
          Konto
        </p>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">
              {snap.primaryAccount.name}
              {snap.primaryAccount.maskedIdentifier
                ? ` ·${snap.primaryAccount.maskedIdentifier}`
                : ""}
            </p>
            <p className="mt-1 text-sm text-[var(--numa-muted)]">
              {snap.verificationLabel ?? "Ej verifierat ännu"}
            </p>
            <p className="text-sm text-[var(--numa-muted)]">
              {snap.balanceKind === "unknown"
                ? "Behöver kontrolleras"
                : "Saldo i synk med beräkning"}
            </p>
          </div>
          <Link href="/konton" className="text-sm text-[var(--numa-accent)]">
            Hantera
          </Link>
        </div>
      </section>
    </div>
  );
}

function BrandHeader() {
  return (
    <header className="flex items-end justify-between">
      <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">NUMA</h1>
      <span className="pb-1 text-xs text-[var(--numa-faint)]">Idag</span>
    </header>
  );
}

function Stat({
  label,
  amount,
  currency,
}: {
  label: string;
  amount: number;
  currency: "THB" | "SEK";
}) {
  return (
    <div>
      <p className="text-sm text-[var(--numa-muted)]">{label}</p>
      <div className="mt-1">
        <MoneyDisplay amountMinor={amount} currency={currency} size="md" compact />
      </div>
    </div>
  );
}

function typeLabel(type: string): string {
  switch (type) {
    case "expense":
      return "Utgift";
    case "income":
      return "Inkomst";
    case "transfer":
      return "Överföring";
    default:
      return "Transaktion";
  }
}

function syncLabel(status: string): string {
  switch (status) {
    case "pending_sync":
      return "Väntar på synk";
    case "saved":
      return "Sparad";
    case "synced":
      return "Synkad";
    default:
      return status;
  }
}
