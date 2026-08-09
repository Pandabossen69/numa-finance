"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AddActionSheet } from "@/components/add/AddActionSheet";

const tabs = [
  { href: "/idag", label: "Idag" },
  { href: "/plan", label: "Plan" },
  { href: "/analys", label: "Analys" },
  { href: "/mer", label: "Mer" },
] as const;

export function BottomNav({
  accountId,
  hasAccount,
}: {
  accountId?: string | null;
  hasAccount: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--numa-border)] bg-[var(--numa-nav)] backdrop-blur-xl"
        style={{ paddingBottom: "var(--numa-safe-bottom)" }}
        aria-label="Huvudnavigering"
      >
        <div className="numa-shell grid grid-cols-5 items-end px-2 pt-2 pb-2">
          <NavLink
            href={tabs[0].href}
            label={tabs[0].label}
            active={pathname.startsWith(tabs[0].href)}
          />
          <NavLink
            href={tabs[1].href}
            label={tabs[1].label}
            active={pathname.startsWith(tabs[1].href)}
          />

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="relative -mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--numa-accent)] text-3xl font-light text-white shadow-[var(--numa-shadow)] transition active:scale-95"
              aria-label="Lägg till"
            >
              <span className="leading-none">+</span>
            </button>
          </div>

          <NavLink
            href={tabs[2].href}
            label={tabs[2].label}
            active={pathname.startsWith(tabs[2].href)}
          />
          <NavLink
            href={tabs[3].href}
            label={tabs[3].label}
            active={pathname.startsWith(tabs[3].href)}
          />
        </div>
      </nav>

      <AddActionSheet
        open={open}
        onClose={() => setOpen(false)}
        accountId={accountId}
        hasAccount={hasAccount}
      />
    </>
  );
}

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium tracking-wide transition ${
        active ? "text-[var(--numa-accent-ink)]" : "text-[var(--numa-faint)]"
      }`}
    >
      <span
        className={`h-1 w-1 rounded-full ${active ? "bg-[var(--numa-accent)]" : "bg-transparent"}`}
        aria-hidden
      />
      {label}
    </Link>
  );
}
