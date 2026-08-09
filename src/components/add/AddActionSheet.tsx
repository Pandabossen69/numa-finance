"use client";

import Link from "next/link";
import { useEffect } from "react";
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(19,32,25,0.55)]"
        aria-label="Stäng"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Lägg till"
        className="relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[1.75rem] border border-[var(--numa-border)] bg-[var(--numa-surface-solid)] px-5 pt-4 pb-[calc(1.25rem+var(--numa-safe-bottom))] text-[var(--numa-ink)] shadow-[var(--numa-shadow)] animate-sheet"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--numa-border)]" />
        <h2 className="mb-1 text-lg font-semibold tracking-tight">Lägg till</h2>
        <p className="mb-5 text-sm text-[var(--numa-muted)]">
          Fota kvitto, eller registrera utgift, inkomst, flytt och kontanter.
        </p>

        {!hasAccount || !accountId ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
              NUMA behöver först veta hur mycket du har just nu. Ingen
              bankkoppling — du anger saldot själv.
            </p>
            <Link
              href="/konton/ny"
              onClick={onClose}
              className="flex min-h-14 items-center justify-center rounded-[1.25rem] bg-[var(--numa-accent)] px-4 text-[15px] font-semibold text-white"
            >
              Ange mitt saldo
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            <Link
              href="/fota"
              onClick={onClose}
              className="flex min-h-14 flex-col justify-center rounded-[1.25rem] bg-[var(--numa-accent)] px-4 text-white transition active:scale-[0.99]"
            >
              <span className="text-[15px] font-semibold">Fota kvitto</span>
              <span className="text-xs text-white/80">
                Kameran öppnas — bekräfta belopp mot dagens plan
              </span>
            </Link>

            <QuickAddForms
              primaryAccountId={accountId}
              accounts={accounts}
              onSuccess={onClose}
            />

            <Link
              href="/importera"
              onClick={onClose}
              className="flex min-h-12 items-center justify-center text-sm text-[var(--numa-muted)]"
            >
              Tidigare importer
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
