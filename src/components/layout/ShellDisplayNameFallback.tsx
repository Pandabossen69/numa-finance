"use client";

import { useSyncExternalStore } from "react";
import {
  lastKnownChromeDisplayName,
  subscribeHomeSnapshot,
} from "@/features/home/last-snapshot";

/**
 * Never paint "Användare". Last-known name only after this session
 * is bound; otherwise a reserved-width skeleton.
 */
export function ShellDisplayNameFallback() {
  const known = useSyncExternalStore(
    subscribeHomeSnapshot,
    lastKnownChromeDisplayName,
    () => null,
  );
  if (known) return known;
  return (
    <span
      className="mt-0.5 block h-[1em] w-[7ch] max-w-[40%] rounded-sm bg-[var(--numa-border)]/70"
      aria-hidden
    />
  );
}
