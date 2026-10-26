"use client";

import Link from "next/link";
import { Calendar, ChartColumn, Ellipsis, Home, Plus } from "lucide-react";
import { useNavIntent } from "@/components/layout/NavIntent";
import { PRIMARY_NAV, isNavActive, type NavIconName } from "@/components/layout/nav";
import { Icon } from "@/components/ui/Icon";
import { usePrefetchOnIntent } from "@/lib/nav/prefetch-intent";
import { isSpaTabHref } from "@/lib/nav/spa-tabs";

const NAV_ICONS = {
  home: Home,
  plan: Calendar,
  analys: ChartColumn,
  mer: Ellipsis,
} as const;

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
            onClick={(event) => onTabClick("/fota", event)}
            className="numa-press numa-fab relative flex items-center justify-center rounded-full"
            aria-label="Lägg till"
          >
            <Icon icon={Plus} />
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
  return (
    <Icon
      icon={NAV_ICONS[name]}
      className={active ? "text-[var(--numa-ink)]" : undefined}
    />
  );
}
