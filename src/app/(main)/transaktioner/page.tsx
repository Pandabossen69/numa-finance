import Link from "next/link";
import { formatMoney, money } from "@/domain/money";
import { listTransactions } from "@/lib/store/repository";

export default async function TransaktionerPage() {
  const transactions = await listTransactions();

  return (
    <div className="space-y-6 pt-2">
      <header>
        <Link href="/mer" className="text-sm text-[var(--numa-muted)]">
          ← Mer
        </Link>
        <h1 className="mt-3 text-[1.65rem] font-semibold tracking-[-0.04em]">
          Utgifter & rörelser
        </h1>
        <p className="mt-2 text-sm text-[var(--numa-muted)]">
          Allt du bekräftat. Överföringar räknas inte som konsumtion.
        </p>
      </header>

      {transactions.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-[var(--numa-muted)]">
            Inga utgifter ännu. Fota ett kvitto eller lägg till via +.
          </p>
          <Link href="/fota" className="text-sm font-medium text-[var(--numa-accent)]">
            Fota kvitto →
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--numa-border)] border-y border-[var(--numa-border)]">
          {transactions.map((tx) => (
            <li key={tx.id} className="flex items-start justify-between gap-3 py-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{tx.description}</p>
                <p className="mt-1 text-xs text-[var(--numa-faint)]">
                  {labelType(tx.transactionType)}
                  {tx.category ? ` · ${tx.category}` : ""} ·{" "}
                  {new Date(tx.occurredAt).toLocaleString("sv-SE")}
                </p>
              </div>
              <span className="money shrink-0 font-semibold">
                {tx.direction === "debit" ? "−" : "+"}
                {formatMoney(money(tx.amountMinor, tx.currency))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function labelType(type: string): string {
  switch (type) {
    case "expense":
      return "Utgift";
    case "income":
      return "Inkomst";
    case "transfer":
      return "Överföring";
    case "cash_withdrawal":
      return "Kontantuttag";
    case "refund":
      return "Återbetalning";
    default:
      return "Övrigt";
  }
}
