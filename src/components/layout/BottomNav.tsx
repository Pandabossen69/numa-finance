"use client";

import Link from "next/link";
import { useNavIntent } from "@/components/layout/NavIntent";
import { PRIMARY_NAV, isNavActive, type NavIconName } from "@/components/layout/nav";
import { usePrefetchOnIntent } from "@/lib/nav/prefetch-intent";
import { isSpaTabHref } from "@/lib/nav/spa-tabs";

/**
 * Icon-only edge dock: stilren B/C-mix with a symmetrical orange + in the
 * center. Labels live in aria-label only — no caption clutter under icons.
 */
export function BottomNav() {
  const { highlightPath, markIntent, pending, navigateSpaTab } = useNavIntent();
  const { prefetch } = usePrefetchOnIntent();

  const left = PRIMARY_NAV.slice(0, 2);
  const right = PRIMARY_NAV.slice(2);

  function activeFor(href: string) {
    return isNavActive(highlightPath, href);
  }

  function onIntent(href: string) {
    // SPA keep-alive: paint dest in this pointerdown turn.
    if (navigateSpaTab(href)) return;
    prefetch(href);
    markIntent(href);
  }

  function onTabClick(
    href: string,
    event: React.MouseEvent<HTMLAnchorElement>,
  ) {
    // pointerdown already switched; only block the browser/Next navigation.
    if (isSpaTabHref(href)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    markIntent(href);
  }

  return (
    <nav
      className="numa-bottom-nav fixed z-50 overflow-x-clip md:hidden"
      aria-label="Huvudnavigering"
    >
      <div className="mx-auto grid h-[var(--numa-nav-bar)] max-w-lg grid-cols-5 items-center px-2">
        {left.map((tab) => (
          <NavItem
            key={tab.href}
            href={tab.href}
            label={tab.label}
            icon={tab.icon}
            active={activeFor(tab.href)}
            pending={Boolean(
              pending && activeFor(pending.href) && activeFor(tab.href),
            )}
            onIntent={() => onIntent(tab.href)}
            onClick={(event) => onTabClick(tab.href, event)}
          />
        ))}
        <div className="flex items-center justify-center">
          <Link
            href="/fota"
            prefetch={false}
            onPointerDown={() => onIntent("/fota")}
            onMouseEnter={() => prefetch("/fota")}
            onFocus={() => prefetch("/fota")}
            onClick={() => onIntent("/fota")}
            className="numa-press numa-fab relative flex items-center justify-center rounded-full"
            aria-label="Lägg till"
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
            pending={Boolean(
              pending && activeFor(pending.href) && activeFor(tab.href),
            )}
            onIntent={() => onIntent(tab.href)}
            onClick={(event) => onTabClick(tab.href, event)}
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
  pending,
  onIntent,
  onClick,
}: {
  href: string;
  label: string;
  icon: NavIconName;
  active: boolean;
  pending: boolean;
  onIntent: () => void;
  onClick: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  // Plain <a> — Next <Link> soft-nav races SPA keep-alive and can no-op
  // when returning to the cold-load tab (router pathname never moved).
  return (
    <a
      href={href}
      onPointerDown={onIntent}
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      aria-busy={pending || undefined}
      className={`numa-press numa-bottom-nav-item relative flex min-h-[var(--numa-touch)] min-w-0 items-center justify-center rounded-xl px-0.5 pb-1 ${
        active ? "is-active" : ""
      }${pending ? " is-pending" : ""}`}
    >
      <NavIcon name={icon} active={active} />
    </a>
  );
}

function NavIcon({ name, active }: { name: NavIconName; active: boolean }) {
  const stroke = active ? "var(--numa-ink)" : "currentColor";
  const common = {
    width: 23,
    height: 23,
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
  };
  const strokeWidth = "1.75";

  switch (name) {
    case "home":
      return (
        <svg {...common} fill="none">
          <path
            d="M4.5 10.5 12 4.5l7.5 6V19a1.5 1.5 0 0 1-1.5 1.5h-3.25v-5.25h-5.5V20.5H6A1.5 1.5 0 0 1 4.5 19v-8.5Z"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        </svg>
      );
    case "plan":
      return (
        <svg {...common} fill="none">
          <rect
            x="4.5"
            y="6"
            width="15"
            height="14"
            rx="2.5"
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
          <path
            d="M8 4.5v3M16 4.5v3M4.5 10.5h15"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </svg>
      );
    case "analys":
      return (
        <svg {...common} fill="none">
          <path
            d="M5 18.5V11M10.5 18.5V7M16 18.5v-5.5M20.5 18.5V5.5"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </svg>
      );
    case "mer":
      return (
        <svg {...common} fill="none">
          <circle cx="6.5" cy="12" r="1.55" fill={stroke} />
          <circle cx="12" cy="12" r="1.55" fill={stroke} />
          <circle cx="17.5" cy="12" r="1.55" fill={stroke} />
        </svg>
      );
  }
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5.75v12.5M5.75 12h12.5"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
      />
    </svg>
  );
}
