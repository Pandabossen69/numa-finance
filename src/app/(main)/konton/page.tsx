import Link from "next/link";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { VerifyBalanceForm } from "@/components/accounts/VerifyBalanceForm";
import {
  calculateAccountBalance,
  filterTransactionsAfterCheckpoint,
} from "@/domain/finance";
import {
  getLatestCheckpoint,
  listAccounts,
  listTransactions,
} from "@/lib/store/repository";

export default async function KontonPage() {
  const accounts = await listAccounts();

  return (
    <div className="animate-rise space-y-6 pt-2">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">Konton</h1>
          <p className="mt-2 text-sm text-[var(--numa-muted)]">
            Beräknat saldo utgår från verifierade punkter.
          </p>
        </div>
        <Link
          href="/konton/ny"
          className="text-sm font-medium text-[var(--numa-accent)]"
        >
          Nytt
        </Link>
      </header>

      {accounts.length === 0 ? (
        <p className="text-sm text-[var(--numa-muted)]">
          Inga konton ännu.{" "}
          <Link href="/konton/ny" className="text-[var(--numa-accent)]">
            Skapa ditt första
          </Link>
        </p>
      ) : (
        <ul className="space-y-8">
          {await Promise.all(
            accounts.map(async (account) => {
              const checkpoint = await getLatestCheckpoint(account.id);
              const txs = await listTransactions(account.id);
              const after = filterTransactionsAfterCheckpoint(txs, checkpoint);
              const calculated = calculateAccountBalance({
                checkpoint,
                transactionsAfterCheckpoint: after,
              });

              return (
                <li
                  key={account.id}
                  className="space-y-4 border-t border-[var(--numa-border)] pt-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-medium">
                        {account.name}
                        {account.maskedIdentifier
                          ? ` ·${account.maskedIdentifier}`
                          : ""}
                      </h2>
                      <p className="text-sm text-[var(--numa-muted)]">
                        {account.institution ?? "Eget konto"} · {account.currency}
                        {account.isDefault ? " · Standard" : ""}
                      </p>
                    </div>
                    {calculated ? (
                      <MoneyDisplay
                        amountMinor={calculated.amountMinor}
                        currency={calculated.currency}
                        size="md"
                      />
                    ) : (
                      <span className="text-sm text-[var(--numa-faint)]">—</span>
                    )}
                  </div>
                  <VerifyBalanceForm accountId={account.id} />
                </li>
              );
            }),
          )}
        </ul>
      )}
    </div>
  );
}
