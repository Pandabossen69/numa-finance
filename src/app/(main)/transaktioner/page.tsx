import Link from "next/link";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { MonthNav } from "@/components/transactions/MonthNav";
import {
  TransactionRow,
  type EditableTx,
} from "@/components/transactions/TransactionEditor";
import {
  buildMonthSummary,
  monthOutcomeCopy,
  parseMonthKey,
} from "@/domain/finance";
import { getProfile, listTransactions } from "@/lib/store/repository";

export default async function TransaktionerPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const params = await searchParams;
  const profile = await getProfile();
  const transactions = await listTransactions();
  const monthKey = parseMonthKey(params.m, profile.timezone);
  const currency = profile.primaryCurrency;
  const summary = buildMonthSummary({
    transactions,
    monthKey,
    currency,
    timezone: profile.timezone,
  });

  return (
    <div className="space-y-5 pt-2 pb-4 text-[var(--numa-ink)]">
      <header className="space-y-2">
        <Link href="/mer" className="text-sm text-[var(--numa-muted)]">
          ← Mer
        </Link>
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">
          Rörelser
        </h1>
        <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
          Allt du lagt in — månad för månad. Tryck på en rad för att ändra namn,
          belopp eller ta bort.
        </p>
      </header>

      <MonthNav
        monthKey={summary.monthKey}
        label={summary.labelSv}
        basePath="/transaktioner"
      />

      <section className="grid grid-cols-3 gap-2">
        <Stat
          label="Ut"
          amount={summary.spending.amountMinor}
          currency={currency}
          tone="out"
        />
        <Stat
          label="In"
          amount={summary.income.amountMinor}
          currency={currency}
          tone="in"
        />
        <Stat
          label="Netto"
          amount={summary.net.amountMinor}
          currency={currency}
          tone={summary.net.amountMinor >= 0 ? "in" : "out"}
        />
      </section>

      <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
        {monthOutcomeCopy(summary)}
      </p>

      {summary.byDay.length === 0 ? (
        <div className="space-y-2 rounded-[1.25rem] border border-[var(--numa-border)] px-4 py-5">
          <p className="text-sm text-[var(--numa-muted)]">
            Tom månad. Lägg till via + — utgift, inkomst, flytt eller kontant.
          </p>
          <Link
            href="/idag"
            className="text-sm font-medium text-[var(--numa-accent)]"
          >
            Tillbaka till Idag →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {summary.byDay.map((day) => (
            <section key={day.dayKey} className="space-y-1">
              <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--numa-faint)]">
                {day.labelSv}
              </h2>
              <ul>
                {day.transactions.map((tx) => {
                  const row: EditableTx = {
                    id: tx.id,
                    description: tx.description,
                    category: tx.category,
                    amountMinor: tx.amountMinor,
                    currency: tx.currency,
                    direction: tx.direction,
                    transactionType: tx.transactionType,
                    source: tx.source,
                    canEdit:
                      tx.source === "manual" || tx.source === "receipt_camera",
                  };
                  return <TransactionRow key={tx.id} tx={row} />;
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  amount,
  currency,
  tone,
}: {
  label: string;
  amount: number;
  currency: "THB" | "SEK";
  tone: "in" | "out";
}) {
  return (
    <div className="rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-3 py-3">
      <p className="text-[11px] text-[var(--numa-faint)]">{label}</p>
      <div
        className={`mt-1 ${
          tone === "in" ? "text-[var(--numa-positive)]" : "text-[var(--numa-ink)]"
        }`}
      >
        <MoneyDisplay
          amountMinor={amount}
          currency={currency}
          size="sm"
          compact
        />
      </div>
    </div>
  );
}
