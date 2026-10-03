"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useNavIntent } from "@/components/layout/NavIntent";
import {
  bankMailToastSnapshot,
  dismissBankMailSavedToast,
  subscribeBankMailToast,
} from "@/features/imports/bank-mail-toast";
import { retryBankMailSurfacesIfStale } from "@/features/imports/bank-mail-queue-refresh";
import { serverNull } from "@/lib/react/server-snapshot";

const VISIBLE_MS = 4_000;

/**
 * Saved-mail toast. Mounted from AppShell, outside keep-alive panels.
 * A portal from the hidden/inert Hem panel never became visible on preview:
 * that panel stays `hidden` until after Bekräfta, and z-40 sat under the
 * update banner (z-80) and the bottom nav (z-50).
 */
export function BankMailSavedToast() {
  const { pathname } = useNavIntent();
  const toast = useSyncExternalStore(
    subscribeBankMailToast,
    bankMailToastSnapshot,
    serverNull,
  );

  useEffect(() => {
    retryBankMailSurfacesIfStale();
  }, [pathname]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismissBankMailSavedToast, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-bank-mail-toast=""
      className="pointer-events-none fixed inset-x-0 z-[100] flex justify-center px-4 bottom-[calc(var(--numa-nav-bar)+var(--numa-fab-overhang)+4.75rem)] md:bottom-24"
    >
      <p
        role="status"
        className="max-w-sm rounded-full border border-[var(--numa-border)] bg-[var(--numa-card)] px-4 py-2.5 text-center text-sm font-medium text-[var(--numa-ink)] shadow-[var(--numa-toast-shadow)]"
      >
        {toast.text}
      </p>
    </div>,
    document.body,
  );
}
