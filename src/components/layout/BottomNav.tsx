"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useLinkStatus } from "next/link";
import { PRIMARY_NAV, isNavActive, type NavIconName } from "@/components/layout/nav";

export function BottomNav() {
  const pathname = usePathname();
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setOptimisticHref(null);
  }, [pathname]);

  const left = PRIMARY_NAV.slice(0, 2);
  const right = PRIMARY_NAV.slice(2);

  function activeFor(href: string) {
    if (optimisticHref) return isNavActive(optimisticHref, href);
    return isNavActive(pathname, href);
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--numa-border)] bg-[var(--numa-nav)]/95 shadow-[0_-8px_32px_rgba(10,26,20,0.06)] backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "var(--numa-safe-bottom)" }}
      aria-label="Huvudnavigering"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-1.5 pb-1.5 pt-1">
        {left.map((tab) => (
          <NavItem
            key={tab.href}
            href={tab.href}
            label={tab.label}
            icon={tab.icon}
            active={activeFor(tab.href)}
            onIntent={() => {
              startTransition(() => setOptimisticHref(tab.href));
            }}
          />
        ))}
        <div className="flex justify-center pb-0.5">
          <Link
            href="/lagg-till"
            prefetch
            onClick={() => startTransition(() => setOptimisticHref("/fota"))}
            className="relative -mt-7 flex h-[3.35rem] w-[3.35rem] items-center justify-center rounded-full bg-[var(--numa-accent)] text-white shadow-[0_10px_28px_rgba(13,122,102,0.35)] transition active:scale-95"
            aria-label="Lägg till eller fota"
          >
            <PlusIcon />
          </Link>
        </div>
        {right.map((tab) => (
          <NavItem
            key={tab.href}
            href={tab.href}
            label={tab.label}
            icon={tab.icon}
            active={activeFor(tab.href)}
            onIntent={() => {
              startTransition(() => setOptimisticHref(tab.href));
            }}
          />
        ))}
      </div>
    </nav>
  );
}

function NavItem({
  href,
  label,
  icon,
  active,
  onIntent,
}: {
  href: string;
  label: string;
  icon: NavIconName;
  active: boolean;
  onIntent: () => void;
}) {
  return (
    <Link
      href={href}
      prefetch
      onClick={onIntent}
      className={`relative flex min-h-[3.35rem] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 transition active:scale-[0.97] ${
        active
          ? "text-[var(--numa-accent-ink)]"
          : "text-[var(--numa-faint)]"
      }`}
    >
      {active ? (
        <span
          className="absolute inset-x-2 top-0.5 bottom-0.5 -z-10 rounded-2xl bg-[var(--numa-accent-soft)]/80"
          aria-hidden
        />
      ) : null}
      <span className="relative">
        <NavIcon name={icon} active={active} />
        <PendingDot />
      </span>
      <span
        className={`text-[10px] font-semibold tracking-wide ${
          active ? "text-[var(--numa-accent-ink)]" : ""
        }`}
      >
        {label}
      </span>
    </Link>
  );
}

function PendingDot() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      className="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--numa-accent)] numa-pulse-soft"
      aria-hidden
    />
  );
}

function NavIcon({ name, active }: { name: NavIconName; active: boolean }) {
  const stroke = active ? "var(--numa-accent)" : "currentColor";
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true as const,
  };

  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path
            d="M4.5 10.5 12 4.5l7.5 6V19a1.5 1.5 0 0 1-1.5 1.5h-3.25v-5.25h-5.5V20.5H6A1.5 1.5 0 0 1 4.5 19v-8.5Z"
            stroke={stroke}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "plan":
      return (
        <svg {...common}>
          <rect
            x="4.5"
            y="6"
            width="15"
            height="14"
            rx="2.5"
            stroke={stroke}
            strokeWidth="1.7"
          />
          <path
            d="M8 4.5v3M16 4.5v3M4.5 10.5h15"
            stroke={stroke}
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );
    case "analys":
      return (
        <svg {...common}>
          <path
            d="M5 18.5V11M10.5 18.5V7M16 18.5v-5.5M20.5 18.5V5.5"
            stroke={stroke}
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );
    case "mer":
      return (
        <svg {...common}>
          <circle cx="6.5" cy="12" r="1.6" fill={stroke} />
          <circle cx="12" cy="12" r="1.6" fill={stroke} />
          <circle cx="17.5" cy="12" r="1.6" fill={stroke} />
        </svg>
      );
  }
}

function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5.5v13M5.5 12h13"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
