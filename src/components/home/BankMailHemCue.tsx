"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { pendingBankMailCountAction } from "@/features/imports/bank-mail-actions";
import { bankMailConfirmHeading } from "@/features/imports/bank-mail-queue";
import {
  bankMailPendingCountSnapshot,
  bankMailPendingCountVersion,
  publishBankMailPendingCount,
  subscribeBankMailPendingCount,
} from "@/features/imports/bank-mail-queue-refresh";
import {
  settledHomeEpoch,
  subscribeSettledHomeEpoch,
} from "@/features/home/invalidate-settled-home";
import { serverNull, serverZero } from "@/lib/react/server-snapshot";

const HREF = "/importera#att-bekrafta";

/** Hem link when mail suggestions are waiting. The toast lives in AppShell. */
export function BankMailHemCue() {
  const publishedCount = useSyncExternalStore(
    subscribeBankMailPendingCount,
    bankMailPendingCountSnapshot,
    serverNull,
  );
  const epoch = useSyncExternalStore(
    subscribeSettledHomeEpoch,
    settledHomeEpoch,
    serverZero,
  );

  useEffect(() => {
    let cancelled = false;
    const seen = bankMailPendingCountVersion();
    void pendingBankMailCountAction().then((next) => {
      if (cancelled || bankMailPendingCountVersion() !== seen) return;
      publishBankMailPendingCount(next);
    });
    return () => {
      cancelled = true;
    };
  }, [epoch]);

  const count = publishedCount ?? 0;

  if (count <= 0) return null;

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
