"use client";

import Link from "next/link";
import { useNavIntent } from "@/components/layout/NavIntent";
import { PRIMARY_NAV, isNavActive } from "@/components/layout/nav";
import { usePrefetchOnIntent } from "@/lib/nav/prefetch-intent";
import { isSpaTabHref } from "@/lib/nav/spa-tabs";

export function SideNav({ displayName }: { displayName: React.ReactNode }) {
  const { highlightPath, markIntent, pending, navigateSpaTab } = useNavIntent();
  const { prefetch } = usePrefetchOnIntent();

  function onIntent(href: string) {
    if (navigateSpaTab(href)) return;
    prefetch(href);
    markIntent(href);
  }

  function onTabClick(
    href: string,
    event: React.MouseEvent<HTMLAnchorElement>,
  ) {
    if (isSpaTabHref(href)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    markIntent(href);
  }

  return (
    <aside className="hidden w-56 shrink-0 md:block">
      <div className="sticky top-0 flex h-dvh flex-col gap-10 py-[max(2.5rem,var(--numa-safe-top))] pr-2">
        <Link
          href="/idag"
          onPointerDown={() => onIntent("/idag")}
          onMouseEnter={() => {
            if (!navigateSpaTab("/idag")) prefetch("/idag");
          }}
          onClick={(event) => onTabClick("/idag", event)}
          className="group block min-w-0 px-1"
        >
          <p className="numa-section-title">Personlig ekonomi</p>
          <p className="mt-1 text-3xl font-semibold tracking-[-0.05em] text-[var(--numa-ink)] transition group-hover:text-[var(--numa-accent-ink)]">
            NUMA
          </p>
          <p
            className="mt-1 truncate text-sm font-semibold tracking-tight text-[var(--numa-accent-ink)]"
            title={typeof displayName === "string" ? displayName : undefined}
          >
            {displayName}
          </p>
        </Link>

        <nav className="flex flex-1 flex-col gap-0.5" aria-label="Sidonavigering">
          {PRIMARY_NAV.map((item) => {
            const active = isNavActive(highlightPath, item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                onPointerDown={() => onIntent(item.href)}
                onClick={(event) => onTabClick(item.href, event)}
                aria-busy={Boolean(pending && active) || undefined}
                aria-current={active ? "page" : undefined}
                className={`numa-press numa-side-nav-item relative min-h-11 rounded-2xl px-1.5 py-3 ${
                  active
                    ? "is-active text-[var(--numa-ink)]"
                    : "text-[var(--numa-muted)] hover:bg-[var(--numa-card)] hover:text-[var(--numa-ink)]"
                }${pending && active ? " is-pending" : ""}`}
              >
                {active ? (
                  <span
                    className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-[var(--numa-accent)]"
                    aria-hidden
                  />
                ) : null}
                <span className="block pl-3 text-sm font-semibold tracking-tight">
                  {item.label}
                </span>
                <span className="mt-0.5 block pl-3 text-xs text-[var(--numa-faint)]">
                  {item.hint}
                </span>
              </a>
            );
          })}
        </nav>

        <div className="space-y-2">
          <Link
            href="/fota"
            prefetch={false}
            onPointerDown={() => {
              prefetch("/fota");
              markIntent("/fota");
            }}
            onMouseEnter={() => prefetch("/fota")}
            onClick={() => markIntent("/fota")}
            className="numa-btn numa-btn-accent flex w-full items-center justify-center gap-2 rounded-full"
            aria-label="Lägg till — fota saldo eller kvitto"
          >
            <span className="text-xl leading-none" aria-hidden>
              +
            </span>
            <span>Lägg till</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
