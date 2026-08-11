import Link from "next/link";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { VerifyBalanceForm } from "@/components/accounts/VerifyBalanceForm";
import {
  MerListGroup,
  MerListRow,
  MerPageHeader,
  MerSection,
} from "@/components/mer/MerHub";
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
    <div className="mx-auto max-w-lg space-y-7">
      <MerPageHeader
        back
        title="Saldo"
        description="Uppdatera när du vill — Hem räknar kvar per dag därifrån."
        action={
          <Link
            href="/konton/ny"
            className="text-[13px] font-semibold text-[var(--numa-accent)]"
          >
            Nytt konto
          </Link>
        }
      />

      {accounts.length === 0 ? (
        <MerSection className="animate-rise-delay-1">
          <MerListGroup>
            <MerListRow className="space-y-3 py-5">
              <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
                Inga saldon ännu. Snabbast är att fota bank-SMS.
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold">
                <Link
                  href="/fota?mode=sms"
                  className="text-[var(--numa-accent)]"
                >
                  Fota bank-SMS →
                </Link>
                <Link href="/konton/ny" className="text-[var(--numa-accent)]">
                  Ange manuellt →
                </Link>
              </div>
            </MerListRow>
          </MerListGroup>
        </MerSection>
      ) : (
        <div className="animate-rise-delay-1 space-y-6">
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
                <MerSection key={account.id}>
                  <MerListGroup>
                    <MerListRow>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="text-[15px] font-semibold tracking-tight">
                            {account.name}
                            {account.maskedIdentifier
                              ? ` ·${account.maskedIdentifier}`
                              : ""}
                          </h2>
                          <p className="mt-0.5 text-[12px] text-[var(--numa-faint)]">
                            {account.institution ?? "Eget konto"} ·{" "}
                            {account.currency}
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
                          <span className="text-sm text-[var(--numa-faint)]">
                            —
                          </span>
                        )}
                      </div>
                    </MerListRow>
                    <MerListRow className="bg-[var(--numa-bg)]/35">
                      <VerifyBalanceForm accountId={account.id} />
                    </MerListRow>
                  </MerListGroup>
                </MerSection>
              );
            }),
          )}
        </div>
      )}
    </div>
  );
}
