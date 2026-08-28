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
    <div className="numa-page numa-page-wide min-w-0 overflow-x-hidden space-y-7">
      <MerPageHeader
        back
        title="Saldo"
        action={
          <Link
            href="/konton/ny"
            className="numa-tap text-[13px] font-semibold text-[var(--numa-accent)]"
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
                  className="numa-tap text-[var(--numa-accent)]"
                >
                  Fota bank-SMS →
                </Link>
                <Link href="/konton/ny" className="numa-tap text-[var(--numa-accent)]">
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
                      <div className="numa-money-line items-start">
                        <div className="numa-money-line-label">
                          <h2 className="truncate text-[15px] font-semibold tracking-tight">
                            {account.name}
                            {account.maskedIdentifier
                              ? ` ·${account.maskedIdentifier}`
                              : ""}
                          </h2>
                          <p className="mt-0.5 truncate text-[12px] text-[var(--numa-faint)]">
                            {account.institution ?? "Eget konto"} ·{" "}
                            {account.currency}
                            {account.isDefault ? " · Standard" : ""}
                          </p>
                        </div>
                        <div className="numa-money-line-amt">
                          {calculated ? (
                            <MoneyDisplay
                              amountMinor={calculated.amountMinor}
                              currency={calculated.currency}
                              size="md"
                              wrap={false}
                            />
                          ) : (
                            <span className="text-sm text-[var(--numa-faint)]">
                              —
                            </span>
                          )}
                        </div>
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
