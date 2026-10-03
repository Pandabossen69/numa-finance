"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { bankMailConfirmHeading } from "@/features/imports/bank-mail-queue";
import {
  bankMailPendingCountSnapshot,
  subscribeBankMailPendingCount,
} from "@/features/imports/bank-mail-queue-refresh";
import { serverNull } from "@/lib/react/server-snapshot";

const HREF = "/importera#att-bekrafta";

/**
 * Hem link when mail suggestions are waiting. The count arrives with the
 * Hem snapshot (same response as the balance), not a second server action.
 * null means unknown — hide the cue instead of flashing «Att bekräfta (0)».
 */
export function BankMailHemCue() {
  const publishedCount = useSyncExternalStore(
    subscribeBankMailPendingCount,
    bankMailPendingCountSnapshot,
    serverNull,
  );

  if (publishedCount == null || publishedCount <= 0) return null;

  return (
    <p className="px-0.5">
      <Link
        href={HREF}
        className="numa-tap inline-flex min-h-11 items-center text-sm font-semibold text-[var(--numa-accent)]"
      >
        {bankMailConfirmHeading(publishedCount)}
      </Link>
    </p>
  );
}
