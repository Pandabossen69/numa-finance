"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { pendingBankMailCountAction } from "@/features/imports/bank-mail-actions";
import { bankMailConfirmHeading } from "@/features/imports/bank-mail-queue";
import {
  bankMailToastSnapshot,
  dismissBankMailSavedToast,
  subscribeBankMailToast,
} from "@/features/imports/bank-mail-toast";

const HREF = "/importera#att-bekrafta";

/** Hem link when mail suggestions are waiting, plus the saved toast. */
export function BankMailHemCue() {
  const toast = useSyncExternalStore(
    subscribeBankMailToast,
    bankMailToastSnapshot,
    () => null,
  );
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void pendingBankMailCountAction().then((next) => {
      if (!cancelled) setCount(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismissBankMailSavedToast, 4200);
    return () => clearTimeout(timer);
  }, [toast]);

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
      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
          <p
            role="status"
            className="max-w-sm rounded-full border border-[var(--numa-border)] bg-[var(--numa-card)] px-4 py-2.5 text-center text-sm font-medium text-[var(--numa-ink)] shadow-[var(--numa-toast-shadow)]"
          >
            {toast}
          </p>
        </div>
      ) : null}
    </>
  );
}
