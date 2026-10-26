"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";
import { Icon } from "@/components/ui/Icon";

/** Short explanation behind a 44px info control. The sentence stays out of the layout until asked. */
export function InfoNote({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        className="numa-press inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--numa-faint)]"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon icon={Info} size={16} />
      </button>
      {open ? (
        <span
          id={id}
          role="note"
          className="absolute left-0 top-full z-20 w-[min(18rem,70vw)] rounded-[var(--numa-radius)] border border-[var(--numa-border)] bg-[var(--numa-card)] px-3 py-2 text-left text-xs font-normal normal-case leading-snug tracking-normal text-[var(--numa-muted)] shadow-[var(--numa-shadow-sm)]"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
