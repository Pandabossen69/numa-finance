import Link from "next/link";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { SetDefaultAccountButton } from "@/components/accounts/SetDefaultAccountButton";
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
    <div className="space-y-6 pt-2 pb-4 text-[var(--numa-ink)]">
      <header className="space-y-2">
        <Link href="/mer" className="text-sm text-[var(--numa-muted)]">
          ← Mer
        </Link>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">
              Mina saldon
            </h1>
            <p className="mt-2 max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
              Standardkontot är det Idag och + räknar ifrån. Du kan byta när du
              vill.
            </p>
          </div>
          <Link
            href="/konton/ny"
            className="shrink-0 text-sm font-medium text-[var(--numa-accent)]"
          >
            Nytt
          </Link>
        </div>
      </header>

      {accounts.length === 0 ? (
        <p className="text-sm text-[var(--numa-muted)]">
          Inga saldon ännu.{" "}
          <Link href="/konton/ny" className="text-[var(--numa-accent)]">
            Ange hur mycket du har
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
                    <div className="min-w-0 space-y-1">
                      <h2 className="font-medium">
                        {account.name}
                        {account.maskedIdentifier
                          ? ` ·${account.maskedIdentifier}`
                          : ""}
                      </h2>
                      <p className="text-sm text-[var(--numa-muted)]">
                        {account.institution ?? "Eget konto"} ·{" "}
                        {account.currency}
                      </p>
                      {account.isDefault ? (
                        <p className="inline-flex rounded-full bg-[var(--numa-accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--numa-accent-ink)]">
                          Standard på Idag
                        </p>
                      ) : (
                        <SetDefaultAccountButton accountId={account.id} />
                      )}
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
                  <VerifyBalanceForm
                    accountId={account.id}
                    afterSave="stay"
                    autoFocus={false}
                  />
                </li>
              );
            }),
          )}
        </ul>
      )}
    </div>
  );
}
