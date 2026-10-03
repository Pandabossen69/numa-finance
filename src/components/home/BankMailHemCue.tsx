"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
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
  bankMailToastSnapshot,
  dismissBankMailSavedToast,
  subscribeBankMailToast,
} from "@/features/imports/bank-mail-toast";
import {
  settledHomeEpoch,
  subscribeSettledHomeEpoch,
} from "@/features/home/invalidate-settled-home";
import { serverNull, serverZero } from "@/lib/react/server-snapshot";

const HREF = "/importera#att-bekrafta";

/** Hem link when mail suggestions are waiting, plus the saved toast. */
export function BankMailHemCue() {
  const toast = useSyncExternalStore(
    subscribeBankMailToast,
    bankMailToastSnapshot,
    serverNull,
  );
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

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismissBankMailSavedToast, 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  const count = publishedCount ?? 0;
  const toastNode =
    toast && typeof document !== "undefined"
      ? createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
            <p
              role="status"
              className="max-w-sm rounded-full border border-[var(--numa-border)] bg-[var(--numa-card)] px-4 py-2.5 text-center text-sm font-medium text-[var(--numa-ink)] shadow-[var(--numa-toast-shadow)]"
            >
              {toast.text}
            </p>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {count > 0 ? (
        <p className="px-0.5">
          <Link
            href={HREF}
            className="numa-tap inline-flex min-h-11 items-center text-sm font-semibold text-[var(--numa-accent)]"
          >
            {bankMailConfirmHeading(count)}
          </Link>
        </p>
      ) : null}
      {toastNode}
    </>
  );
}
