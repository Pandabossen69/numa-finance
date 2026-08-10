"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCheckpointAction } from "@/features/finance/actions";

export function VerifyBalanceForm({
  accountId,
  onSuccess,
  autoFocus = false,
  afterSave = "stay",
}: {
  accountId: string;
  onSuccess?: () => void;
  autoFocus?: boolean;
  /** Where to go after save. Sheet/Idag use "idag"; Konton keeps you here. */
  afterSave?: "idag" | "stay";
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [balance, setBalance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!autoFocus) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [autoFocus]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);

    if (!balance.trim()) {
      setError("Skriv hur mycket du har just nu, t.ex. 10058,04");
      inputRef.current?.focus();
      return;
    }

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
      onSuccess?.();
      if (afterSave === "idag") {
        window.location.assign("/idag");
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block">
        <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-[var(--numa-faint)]">
          Hur mycket har du just nu?
        </span>
        <input
          ref={inputRef}
          value={balance}
          onChange={(e) => {
            setBalance(e.target.value);
            if (error) setError(null);
            if (done) setDone(false);
          }}
          inputMode="decimal"
          placeholder="t.ex. 10058,04"
          className="money min-h-14 w-full rounded-2xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-4 text-2xl font-semibold text-[var(--numa-ink)] outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
          aria-label="Saldo just nu"
        />
      </label>
      <p className="text-xs leading-relaxed text-[var(--numa-muted)]">
        Skriv beloppet först — sedan sparar du.
      </p>
      {error ? (
        <p className="text-sm text-[var(--numa-danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {done ? (
        <p
          className="text-sm text-[var(--numa-positive)]"
          role="status"
        >
          Saldo sparat.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--numa-accent)] text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? "Sparar…" : "Spara saldo"}
      </button>
    </form>
  );
}
