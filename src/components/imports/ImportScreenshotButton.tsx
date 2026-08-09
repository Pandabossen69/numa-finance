"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerScreenshotImportAction } from "@/features/finance/actions";

export function ImportScreenshotButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await registerScreenshotImportAction();
            if (!result.ok) {
              setMessage(result.error);
              return;
            }
            setMessage("Observation sparad.");
            router.refresh();
          });
        }}
        className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--numa-accent)] text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Sparar…" : "Registrera importpunkt"}
      </button>
      {message ? <p className="text-sm text-[var(--numa-muted)]">{message}</p> : null}
    </div>
  );
}
