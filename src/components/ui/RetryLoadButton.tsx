"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const RETRY_AT_KEY = "numa.loadRetryAt";
const RETRY_COOLDOWN_MS = 20_000;

export function RetryLoadButton({
  label = "Försök igen",
}: {
  label?: string;
}) {
  const router = useRouter();

  useEffect(() => {
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(RETRY_AT_KEY) ?? 0);
    } catch {
      last = 0;
    }
    if (Date.now() - last < RETRY_COOLDOWN_MS) return;
    try {
      sessionStorage.setItem(RETRY_AT_KEY, String(Date.now()));
    } catch {
      // Private mode / blocked storage — user can tap the button.
    }
    const timer = window.setTimeout(() => router.refresh(), 400);
    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <button
      type="button"
      className="numa-press text-sm font-semibold text-[var(--numa-accent)]"
      onClick={() => router.refresh()}
    >
      {label}
    </button>
  );
}
