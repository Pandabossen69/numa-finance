"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AddActionSheet } from "@/components/add/AddActionSheet";
import type { ShellAccount } from "@/components/add/QuickAddForms";

const tabs = [
  { href: "/idag", label: "Idag", icon: "●" },
  { href: "/plan", label: "Plan", icon: "▣" },
  { href: "/analys", label: "Analys", icon: "◔" },
  { href: "/mer", label: "Mer", icon: "☰" },
] as const;

const MER_PREFIXES = [
  "/mer",
  "/konton",
  "/transaktioner",
  "/importera",
  "/installningar",
  "/fota",
  "/bank-sms",
];

export function BottomNav({
  accountId,
  hasAccount,
  accounts,
}: {
  accountId?: string | null;
  hasAccount: boolean;
  accounts: ShellAccount[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function isActive(href: string): boolean {
    if (href === "/mer") {
      return MER_PREFIXES.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`),
      );
    }
    return pathname.startsWith(href);
  }

  return (
    <>
      <nav
        className={`fixed inset-x-0 bottom-0 border-t border-[var(--numa-border)] bg-[var(--numa-nav)] backdrop-blur-xl ${
          open ? "z-[60]" : "z-40"
        }`}
        style={{ paddingBottom: "var(--numa-safe-bottom)" }}
        aria-label="Huvudnavigering"
      >
        <div className="numa-shell grid grid-cols-5 items-end px-2 pt-2 pb-2">
          <NavLink
            href={tabs[0].href}
            label={tabs[0].label}
            icon={tabs[0].icon}
            active={isActive(tabs[0].href)}
            onNavigate={() => setOpen(false)}
          />
          <NavLink
            href={tabs[1].href}
            label={tabs[1].label}
            icon={tabs[1].icon}
            active={isActive(tabs[1].href)}
            onNavigate={() => setOpen(false)}
          />

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="relative -mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--numa-accent)] text-3xl font-light text-white shadow-[var(--numa-shadow)] transition active:scale-95"
              aria-label={open ? "Stäng" : "Lägg till"}
              aria-expanded={open}
            >
              <span className="leading-none">{open ? "×" : "+"}</span>
            </button>
          </div>

          <NavLink
            href={tabs[2].href}
            label={tabs[2].label}
            icon={tabs[2].icon}
            active={isActive(tabs[2].href)}
            onNavigate={() => setOpen(false)}
          />
          <NavLink
            href={tabs[3].href}
            label={tabs[3].label}
            icon={tabs[3].icon}
            active={isActive(tabs[3].href)}
            onNavigate={() => setOpen(false)}
          />
        </div>
      </nav>

      <AddActionSheet
        open={open}
        onClose={() => setOpen(false)}
        accountId={accountId}
        hasAccount={hasAccount}
        accounts={accounts}
      />
    </>
  );
}

function NavLink({
  href,
  label,
  icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();

  return (
    <a
      href={href}
      onClick={(event) => {
        // Prefer soft navigation, but never let a stuck App Router leave the
        // tab dead — hard-navigate if the route hasn't changed shortly after.
        event.preventDefault();
        onNavigate?.();
        const before = window.location.pathname;
        router.push(href);
        window.setTimeout(() => {
          if (
            window.location.pathname === before &&
            before !== href &&
            !window.location.pathname.startsWith(href)
          ) {
            window.location.assign(href);
          }
        }, 400);
      }}
      className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium tracking-wide transition ${
        active ? "text-[var(--numa-accent-ink)]" : "text-[var(--numa-faint)]"
      }`}
    >
      <span className="text-[13px] leading-none" aria-hidden>
        {icon}
      </span>
      {label}
    </a>
  );
}
