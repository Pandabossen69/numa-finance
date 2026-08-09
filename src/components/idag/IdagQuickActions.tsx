"use client";

import Link from "next/link";
import { useState } from "react";
import { VerifyBalanceForm } from "@/components/accounts/VerifyBalanceForm";

export function IdagQuickActions({
  accountId,
  verificationLabel,
  stale,
}: {
  accountId: string;
  verificationLabel: string | null;
  stale: boolean;
}) {
  const [open, setOpen] = useState(stale);

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/fota"
          className="flex min-h-14 flex-col justify-center rounded-[1.25rem] bg-[var(--numa-accent)] px-4 text-white transition active:scale-[0.99]"
        >
          <span className="text-sm font-semibold">Fota kvitto</span>
          <span className="text-[11px] text-white/80">Snabbaste vägen</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-14 flex-col justify-center rounded-[1.25rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-4 text-left transition active:scale-[0.99]"
        >
          <span className="text-sm font-semibold">Uppdatera saldo</span>
          <span className="text-[11px] text-[var(--numa-faint)]">
            {stale ? "Dags att kolla" : "Håll NUMA i fas"}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/plan"
          className="flex min-h-12 items-center justify-center rounded-2xl border border-[var(--numa-border)] text-sm font-medium"
        >
          Justera plan
        </Link>
        <p className="flex min-h-12 items-center justify-center px-2 text-center text-xs leading-snug text-[var(--numa-faint)]">
          {verificationLabel
            ? `Saldo ${verificationLabel.toLowerCase()}`
            : "Saldo ej uppdaterat ännu"}
        </p>
      </div>

      {open ? (
        <div className="rounded-[1.35rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-4 py-4 animate-sheet">
          <VerifyBalanceForm
            accountId={accountId}
            autoFocus
            afterSave="idag"
            onSuccess={() => setOpen(false)}
          />
        </div>
      ) : null}

      {stale && !open ? (
        <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
          Det är ett tag sedan du uppdaterade saldot. En snabb koll gör planen
          mer pålitlig.
        </p>
      ) : null}
    </section>
  );
}
