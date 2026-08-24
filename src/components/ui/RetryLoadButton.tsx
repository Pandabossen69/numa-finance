"use client";

import { useRouter } from "next/navigation";

export function RetryLoadButton({
  label = "Försök igen",
}: {
  label?: string;
}) {
  const router = useRouter();
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
