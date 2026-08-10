"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreateAccountForm } from "@/components/accounts/CreateAccountForm";
import { VerifyBalanceForm } from "@/components/accounts/VerifyBalanceForm";
import {
  QuickAddForms,
  type ShellAccount,
} from "@/components/add/QuickAddForms";

export function AddActionSheet({
  open,
  onClose,
  accountId,
  hasAccount,
  accounts,
}: {
  open: boolean;
  onClose: () => void;
  accountId?: string | null;
  hasAccount: boolean;
  accounts: ShellAccount[];
}) {
  const router = useRouter();
  const [setupSaldo, setSetupSaldo] = useState(false);
  const [updateSaldo, setUpdateSaldo] = useState(false);

  function close() {
    setSetupSaldo(false);
    setUpdateSaldo(false);
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSetupSaldo(false);
      setUpdateSaldo(false);
      onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  function go(href: string) {
    close();
    // Full navigation avoids stuck soft-routes after stale service-worker HTML.
    window.location.assign(href);
  }

  const needsSetup = !hasAccount || !accountId;

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex items-end justify-center"
      style={{ bottom: "calc(5.75rem + var(--numa-safe-bottom))" }}
    >
      <button
        type="button"
        className="absolute inset-0 z-0 bg-[rgba(19,32,25,0.55)]"
        aria-label="Stäng"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Lägg till"
        className="relative z-10 max-h-full w-full max-w-md overflow-y-auto rounded-t-[1.75rem] border border-[var(--numa-border)] bg-[var(--numa-surface-solid)] px-5 pt-4 pb-5 text-[var(--numa-ink)] shadow-[var(--numa-shadow)] animate-sheet"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--numa-border)]" />
        <h2 className="mb-1 text-lg font-semibold tracking-tight">
          {needsSetup
            ? setupSaldo
              ? "Lägg till saldo"
              : "Kom igång"
            : updateSaldo
              ? "Uppdatera saldo"
              : "Lägg till"}
        </h2>
        <p className="mb-5 text-sm text-[var(--numa-muted)]">
          {needsSetup
            ? "NUMA behöver först veta hur mycket du har just nu. Ingen bankkoppling — du anger saldot själv."
            : updateSaldo
              ? "Titta i bankappen eller senaste SMS och skriv in beloppet."
              : "Skriv vad det var och hur mycket — namn, belopp, klart. Du kan ändra eller ta bort efteråt under Rörelser."}
        </p>

        {needsSetup ? (
          setupSaldo ? (
            <CreateAccountForm
              onSuccess={() => {
                close();
                router.refresh();
              }}
            />
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setSetupSaldo(true)}
                className="flex min-h-14 w-full items-center justify-center rounded-[1.25rem] bg-[var(--numa-accent)] px-4 text-[15px] font-semibold text-white transition active:scale-[0.99]"
              >
                Lägg till saldo
              </button>
              <button
                type="button"
                onClick={() => go("/konton/ny")}
                className="flex min-h-12 w-full items-center justify-center text-sm text-[var(--numa-muted)]"
              >
                Öppna på egen sida
              </button>
            </div>
          )
        ) : (
          <div className="space-y-5">
            {updateSaldo ? (
              <div className="space-y-3">
                {accountId ? (
                  <VerifyBalanceForm
                    accountId={accountId}
                    autoFocus
                    afterSave="idag"
                    onSuccess={() => {
                      close();
                    }}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => setUpdateSaldo(false)}
                  className="flex min-h-12 w-full items-center justify-center text-sm text-[var(--numa-muted)]"
                >
                  Tillbaka
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => go("/fota")}
                  className="flex min-h-14 w-full flex-col justify-center rounded-[1.25rem] bg-[var(--numa-accent)] px-4 text-left text-white transition active:scale-[0.99]"
                >
                  <span className="text-[15px] font-semibold">Fota kvitto</span>
                  <span className="text-xs text-white/80">
                    Kameran öppnas — bekräfta belopp mot dagens plan
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => go("/bank-sms")}
                  className="flex min-h-14 w-full flex-col justify-center rounded-[1.25rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-4 text-left transition active:scale-[0.99]"
                >
                  <span className="text-[15px] font-semibold">
                    Importera bank-SMS
                  </span>
                  <span className="text-xs text-[var(--numa-faint)]">
                    Skärmdump efter köp — belopp + saldo, utan dubbletter
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setUpdateSaldo(true)}
                  className="flex min-h-14 w-full flex-col justify-center rounded-[1.25rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-4 text-left transition active:scale-[0.99]"
                >
                  <span className="text-[15px] font-semibold">
                    Uppdatera saldo
                  </span>
                  <span className="text-xs text-[var(--numa-faint)]">
                    Håll NUMA i fas med banken
                  </span>
                </button>

                {accountId ? (
                  <QuickAddForms
                    primaryAccountId={accountId}
                    accounts={accounts}
                    onSuccess={close}
                  />
                ) : null}

                <button
                  type="button"
                  onClick={() => go("/importera")}
                  className="flex min-h-12 w-full items-center justify-center text-sm text-[var(--numa-muted)]"
                >
                  Tidigare importer
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
