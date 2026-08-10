"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDefaultAccountAction } from "@/features/finance/actions";

export function SetDefaultAccountButton({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await setDefaultAccountAction(accountId);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
        className="min-h-10 rounded-xl border border-[var(--numa-border)] px-3 text-sm font-medium text-[var(--numa-accent)] transition active:scale-[0.99] disabled:opacity-50"
      >
        {pending ? "Byter…" : "Använd på Idag"}
      </button>
      {error ? (
        <p className="text-xs text-[var(--numa-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
