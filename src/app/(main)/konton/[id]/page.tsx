import { notFound } from "next/navigation";
import {
  AccountDetailHeading,
  ManageAccountForm,
} from "@/components/accounts/ManageAccountForm";
import { MerBackLink } from "@/components/mer/MerHub";
import { DEFAULT_TIMEZONE, formatListDateSv } from "@/domain/finance";
import { formatMoney, money } from "@/domain/money";
import {
  loadAccountDetail,
  type AccountDetail,
} from "@/features/finance/load-account-detail";

export const dynamic = "force-dynamic";

export default async function KontoDetaljPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadAccountDetail(id);
  if (!result.ok && result.notFound) notFound();

  return (
    <div className="numa-page numa-page-wide min-w-0 overflow-x-hidden space-y-6 pt-2 text-[var(--numa-ink)]">
      <header className="space-y-2">
        <MerBackLink href="/konton" label="Konton" />
        <AccountDetailHeading
          id={result.ok ? result.data.id : null}
          name={result.ok ? result.data.name : "Konto"}
        />
        <p className="text-[15px] leading-relaxed text-[var(--numa-muted)]">
          {result.ok && !result.data.isActive
            ? "Arkiverat konto. Historiken är kvar."
            : "Ändra namn och typ, eller ta bort kontot."}
        </p>
      </header>
      {result.ok ? (
        <>
          <ManageAccountForm account={result.data} />
          {!result.data.isActive ? (
            <ArchivedAccountMovements account={result.data} />
          ) : null}
        </>
      ) : (
        <p className="text-sm text-[var(--numa-danger)]" role="alert">
          {result.error}
        </p>
      )}
    </div>
  );
}

function ArchivedAccountMovements({ account }: { account: AccountDetail }) {
  return (
    <section className="space-y-2" aria-label="Rörelser">
      <h2 className="text-sm font-semibold tracking-tight">Rörelser</h2>
      {account.movements.length === 0 ? (
        <p className="text-sm text-[var(--numa-muted)]">Inga rörelser</p>
      ) : (
        <ul className="divide-y divide-[var(--numa-border)] border-y border-[var(--numa-border)]">
          {account.movements.map((tx) => (
            <li
              key={tx.id}
              className="flex items-baseline justify-between gap-3 py-3"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {tx.description.trim() || "Rörelse"}
                </span>
                <span className="text-xs text-[var(--numa-faint)]">
                  {formatListDateSv(tx.occurredAt, DEFAULT_TIMEZONE)}
                </span>
              </span>
              <span className="money shrink-0 text-sm font-semibold">
                {tx.direction === "credit" ? "+" : "−"}
                {formatMoney(money(tx.amountMinor, tx.currency))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
