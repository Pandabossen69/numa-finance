"use client";

import Link from "next/link";
import { useNavIntent } from "@/components/layout/NavIntent";
import { PRIMARY_NAV, isNavActive, type NavIconName } from "@/components/layout/nav";

export function BottomNav() {
  const { highlightPath, markIntent } = useNavIntent();

  const left = PRIMARY_NAV.slice(0, 2);
  const right = PRIMARY_NAV.slice(2);

  function activeFor(href: string) {
    return isNavActive(highlightPath, href);
  }

  function onIntent(href: string) {
    markIntent(href);
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 rounded-t-[1.7rem] border-t border-[var(--numa-border)] bg-[var(--numa-nav)]/92 shadow-[0_-12px_32px_rgba(120,88,48,0.08)] backdrop-blur-2xl md:hidden"
      style={{ paddingBottom: "var(--numa-safe-bottom)" }}
      aria-label="Huvudnavigering"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-1 pb-1.5 pt-1.5">
        {left.map((tab) => (
          <NavItem
            key={tab.href}
            href={tab.href}
            label={tab.label}
            icon={tab.icon}
            active={activeFor(tab.href)}
            onIntent={() => onIntent(tab.href)}
          />
        ))}
        <div className="flex flex-col items-center justify-end gap-0.5 pb-0.5">
          <Link
            href="/fota"
            prefetch
            onClick={() => onIntent("/fota")}
            className="numa-press relative -mt-7 flex h-[3.6rem] w-[3.6rem] items-center justify-center rounded-full bg-[var(--numa-ink)] text-[var(--numa-card)] shadow-[0_10px_24px_rgba(22,21,19,0.22)] ring-[5px] ring-[var(--numa-bg)]"
            aria-label="Fota eller lägg till"
          >
            <PlusIcon />
          </Link>
          <span className="text-[10px] font-semibold tracking-wide text-[var(--numa-ink)]">
            Fota
          </span>
        </div>
        {right.map((tab) => (
          <NavItem
            key={tab.href}
            href={tab.href}
            label={tab.label}
            icon={tab.icon}
            active={activeFor(tab.href)}
            onIntent={() => onIntent(tab.href)}
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
      aria-current={active ? "page" : undefined}
      className={`numa-press relative flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 rounded-[1.15rem] px-1 ${
        active
          ? "bg-[var(--numa-accent-soft)] text-[var(--numa-ink)]"
          : "text-[var(--numa-faint)]"
      }`}
    >
      <NavIcon name={icon} active={active} />
      <span
        className={`text-[10px] font-semibold tracking-wide ${
          active ? "text-[var(--numa-ink)]" : ""
        }`}
      >
        {label}
      </span>
    </Link>
  );
}

function NavIcon({ name, active }: { name: NavIconName; active: boolean }) {
  const stroke = active ? "var(--numa-ink)" : "currentColor";
  const fill = "none";
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
  };

  switch (name) {
    case "home":
      return (
        <svg {...common} fill={fill}>
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
        <svg {...common} fill={fill}>
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
            fill="none"
          />
        </svg>
      );
    case "analys":
      return (
        <svg {...common} fill="none">
          <path
            d="M5 18.5V11M10.5 18.5V7M16 18.5v-5.5M20.5 18.5V5.5"
            stroke={stroke}
            strokeWidth={active ? "2.2" : "1.7"}
            strokeLinecap="round"
          />
        </svg>
      );
    case "mer":
      return (
        <svg {...common} fill="none">
          <circle cx="6.5" cy="12" r="1.7" fill={stroke} />
          <circle cx="12" cy="12" r="1.7" fill={stroke} />
          <circle cx="17.5" cy="12" r="1.7" fill={stroke} />
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
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
