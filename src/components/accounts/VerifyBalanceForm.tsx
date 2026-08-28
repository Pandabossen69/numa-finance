"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCheckpointAction } from "@/features/finance/actions";
import { refreshQuiet } from "@/lib/nav/instant";

export function VerifyBalanceForm({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [balance, setBalance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
      refreshQuiet(router);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2.5">
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--numa-faint)]">
          Hur mycket har du just nu?
        </span>
        <input
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          inputMode="decimal"
          placeholder="t.ex. 10058,04"
          className="money min-h-11 w-full rounded-xl border border-[var(--numa-border)] bg-[var(--numa-surface-solid)] px-3.5 text-base font-semibold outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
        />
      </label>
      {error ? (
        <p className="text-sm text-[var(--numa-danger)]" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || !balance.trim()}
        className="flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--numa-border)] bg-[var(--numa-surface-solid)] text-sm font-medium transition hover:border-[var(--numa-border-strong)] disabled:opacity-50"
      >
        {pending ? "Sparar…" : "Spara saldo"}
      </button>
    </form>
  );
}
