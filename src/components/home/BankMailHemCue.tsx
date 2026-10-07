"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { bankMailConfirmHeading } from "@/features/imports/bank-mail-queue";
import {
  bankMailPendingCountSnapshot,
  bankMailPendingCountVersion,
  subscribeBankMailPendingCount,
} from "@/features/imports/bank-mail-queue-refresh";
import { serverNull, serverZero } from "@/lib/react/server-snapshot";

const HREF = "/importera#att-bekrafta";

/**
 * Hem link when mail suggestions are waiting. Last-known count paints with
 * the saldo shell; the live read replaces it in place. null means unknown —
 * hide the cue instead of flashing «Att bekräfta (0)».
 */
export function BankMailHemCue({
  knownCount = null,
}: {
  knownCount?: number | null;
}) {
  const publishedCount = useSyncExternalStore(
    subscribeBankMailPendingCount,
    bankMailPendingCountSnapshot,
    serverNull,
  );
  const version = useSyncExternalStore(
    subscribeBankMailPendingCount,
    bankMailPendingCountVersion,
    serverZero,
  );
  // A Bekräfta or Hem fetch (version > 0) wins over the SSR cookie. Falling
  // back to knownCount after that brought a stale «Att bekräfta» back.
  const count = version > 0 ? publishedCount : (publishedCount ?? knownCount);

  if (count == null || count <= 0) return null;

  return (
    <p className="px-0.5">
      <Link
        href={HREF}
        className="numa-tap inline-flex min-h-11 items-center text-sm font-semibold text-[var(--numa-accent)]"
      >
        {bankMailConfirmHeading(count)}
      </Link>
    </p>
  );
}
