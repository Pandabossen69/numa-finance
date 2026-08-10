"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCheckpointAction } from "@/features/finance/actions";

export function IdagQuickActions({
  accountId,
  verificationLabel,
  stale,
}: {
  accountId: string;
  verificationLabel: string | null;
  stale: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(stale);
  const [balance, setBalance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/fota"
          className="flex min-h-14 flex-col justify-center rounded-[1.25rem] bg-[var(--numa-accent)] px-4 text-white transition active:scale-[0.99]"
        >
          <span className="text-sm font-semibold">Fota kvitto</span>
          <span className="text-[11px] text-white/80">Läs belopp automatiskt</span>
        </Link>
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            setDone(false);
          }}
          className="flex min-h-14 flex-col justify-center rounded-[1.25rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-4 text-left transition active:scale-[0.99]"
        >
          <span className="text-sm font-semibold">Uppdatera saldo</span>
          <span className="text-[11px] text-[var(--numa-faint)]">
            {stale ? "Dags att kolla" : "Håll siffrorna sanna"}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/plan"
          className="flex min-h-12 items-center justify-center rounded-2xl border border-[var(--numa-border)] text-sm font-medium"
        >
          Mål & plan
        </Link>
        <a
          href="/fota"
          className="flex min-h-12 items-center justify-center rounded-2xl border border-[var(--numa-border)] text-sm font-medium"
        >
          Skärmbild
        </a>
      </div>

      {verificationLabel ? (
        <p className="text-center text-xs text-[var(--numa-faint)]">
          Saldo {verificationLabel.toLowerCase()}
        </p>
      ) : null}

      {open ? (
        <form
          className="space-y-3 rounded-[1.35rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-4 py-4 animate-sheet"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setDone(false);
            startTransition(async () => {
              const result = await createCheckpointAction({
                accountId,
                balance,
                source: "manual_verification",
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setBalance("");
              setDone(true);
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <p className="text-sm font-medium">Hur mycket har du just nu?</p>
          <p className="text-xs leading-relaxed text-[var(--numa-muted)]">
            Titta i bankappen — ingen bankkoppling behövs.
          </p>
          <input
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            inputMode="decimal"
            autoFocus
            placeholder="t.ex. 10058,04"
            className="money min-h-14 w-full rounded-2xl border border-[var(--numa-border)] bg-white/70 px-4 text-2xl font-semibold outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
            aria-label="Saldo just nu"
          />
          {error ? (
            <p className="text-sm text-[var(--numa-danger)]" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending || !balance.trim()}
            className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--numa-accent)] text-sm font-semibold text-white disabled:opacity-45"
          >
            {pending ? "Sparar…" : "Spara saldo"}
          </button>
        </form>
      ) : null}

      {done ? (
        <p
          className="rounded-2xl bg-[color-mix(in_srgb,var(--numa-positive)_14%,transparent)] px-4 py-3 text-sm text-[var(--numa-positive)]"
          role="status"
        >
          Saldo uppdaterat — budgeten räknas om direkt.
        </p>
      ) : null}

      {stale && !open ? (
        <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
          Det är ett tag sedan du uppdaterade saldot. En snabb koll gör budgeten
          mer pålitlig.
        </p>
      ) : null}
    </section>
  );
}
