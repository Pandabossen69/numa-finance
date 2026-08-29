"use client";

import { useEffect, useRef, useState } from "react";
import { PlanDateField } from "@/components/plan/PlanDateField";

export function InlineAdd({
  name,
  amount,
  extra,
  extraLabel,
  namePlaceholder,
  amountPlaceholder,
  submitLabel,
  collapsedLabel,
  open,
  scrollOnOpen = true,
  onOpen,
  onClose,
  busy = false,
  onName,
  onAmount,
  onExtra,
  onSubmit,
}: {
  name: string;
  amount: string;
  extra: string;
  extraLabel: string;
  namePlaceholder: string;
  amountPlaceholder: string;
  submitLabel: string;
  collapsedLabel: string;
  open: boolean;
  scrollOnOpen?: boolean;
  onOpen: () => void;
  onClose: () => void;
  busy?: boolean;
  onName: (v: string) => void;
  onAmount: (v: string) => void;
  onExtra: (v: string) => void;
  onSubmit: () => void;
}) {
  const disabled = busy || !name.trim() || !amount.trim() || !String(extra).trim();
  const submitRowRef = useRef<HTMLDivElement>(null);
  const [fieldsMounted, setFieldsMounted] = useState(open);
  if (open && !fieldsMounted) {
    setFieldsMounted(true);
  }
  // Button and fields never share a frame — even on the first open paint.
  const showFields = open || fieldsMounted;

  useEffect(() => {
    if (!open || !scrollOnOpen) return;
    const node = submitRowRef.current;
    if (!node) return;
    const id = window.setTimeout(() => {
      node.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "smooth",
      });
    }, 220);
    return () => window.clearTimeout(id);
  }, [open, scrollOnOpen]);

  useEffect(() => {
    if (open || !fieldsMounted) return;
    const id = window.setTimeout(() => setFieldsMounted(false), 280);
    return () => window.clearTimeout(id);
  }, [open, fieldsMounted]);

  return (
    <div
      className={`mt-auto border-t border-[var(--numa-border)] pt-4 ${
        open
          ? "pb-[calc(var(--numa-nav-bar)+var(--numa-fab-overhang)+1.75rem)] md:pb-0"
          : ""
      }`}
    >
      {showFields ? (
        <div
          className={`numa-expand ${open ? "is-open" : ""}`}
          onTransitionEnd={(event) => {
            if (event.propertyName !== "grid-template-rows") return;
            if (!open) setFieldsMounted(false);
          }}
        >
          <div className="numa-expand-inner space-y-2">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_minmax(9.5rem,11rem)]">
              <input
                value={name}
                onChange={(e) => onName(e.target.value)}
                placeholder={namePlaceholder}
                className="min-h-11 min-w-0 rounded-xl border border-[var(--numa-border)] bg-transparent px-3 text-base outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
              />
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => onAmount(e.target.value)}
                placeholder={amountPlaceholder}
                className="money min-h-11 min-w-0 rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)]/80 px-3 text-base font-semibold outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
              />
              <PlanDateField value={extra} onChange={onExtra} ariaLabel={extraLabel} />
            </div>
            <div
              ref={submitRowRef}
              className="flex scroll-mb-[calc(var(--numa-nav-bar)+var(--numa-fab-overhang)+var(--numa-safe-bottom)+0.75rem)] gap-2 md:scroll-mb-0"
            >
              <button
                type="button"
                disabled={disabled}
                className="numa-btn numa-btn-soft min-w-0 flex-1"
                onClick={onSubmit}
              >
                {busy ? "Sparar…" : submitLabel}
              </button>
              <button
                type="button"
                disabled={busy}
                className="numa-press min-h-12 rounded-xl px-3 text-sm text-[var(--numa-muted)] disabled:opacity-45"
                onClick={onClose}
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" className="numa-btn numa-btn-soft w-full" onClick={onOpen}>
          {collapsedLabel}
        </button>
      )}
    </div>
  );
}
