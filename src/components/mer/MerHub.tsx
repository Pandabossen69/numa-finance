"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePrefetchOnIntent } from "@/lib/nav/prefetch-intent";

export function MerBackLink({
  href = "/mer",
  label = "Mer",
}: {
  href?: string;
  label?: string;
}) {
  const { prefetch: prefetchHref } = usePrefetchOnIntent();
  return (
    <Link
      href={href}
      prefetch
      onPointerDown={() => prefetchHref(href)}
      onMouseEnter={() => prefetchHref(href)}
      onFocus={() => prefetchHref(href)}
      className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-[var(--numa-muted)] transition hover:text-[var(--numa-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)] focus-visible:ring-offset-2"
    >
      <ChevronLeft className="opacity-70" />
      {label}
    </Link>
  );
}

export function MerPageHeader({
  title,
  description,
  action,
  back,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  back?: boolean;
}) {
  return (
    <header className="animate-rise space-y-3">
      {back ? <MerBackLink /> : null}
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3 md:gap-4">
        <div className="min-w-0">
          <h1 className="numa-page-title">{title}</h1>
          {description ? (
            <p className="mt-1.5 max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}

export function MerSection({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-2 ${className}`.trim()}>
      {title ? (
        <h2 className="numa-section-title px-1">{title}</h2>
      ) : null}
      {children}
    </section>
  );
}

export function MerListGroup({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`numa-panel-list ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export type MerIconTone = "accent" | "positive" | "spend" | "alarm" | "neutral";

const MER_ICON_TONE_CLASS: Record<MerIconTone, string> = {
  accent: "bg-[var(--numa-accent-soft)] text-[var(--numa-accent-ink)]",
  positive: "bg-[var(--numa-positive-soft)] text-[var(--numa-positive)]",
  spend: "bg-[var(--numa-spend-soft)] text-[var(--numa-spend)]",
  alarm: "bg-[var(--numa-alarm-soft)] text-[var(--numa-alarm)]",
  neutral: "bg-[var(--numa-chip-neutral)] text-[var(--numa-ink)]",
};

export function MerIcon({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: MerIconTone;
}) {
  return (
    <span
      aria-hidden
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.85rem] ${MER_ICON_TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

export function MerAvatar({
  initial,
  tone = "accent",
}: {
  initial: string;
  tone?: MerIconTone;
}) {
  return (
    <span
      aria-hidden
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${MER_ICON_TONE_CLASS[tone]}`}
    >
      {initial}
    </span>
  );
}

export function MerListLink({
  href,
  label,
  hint,
  trailing,
  icon,
  tone = "neutral",
}: {
  href: string;
  label: string;
  hint?: string;
  trailing?: ReactNode;
  icon?: ReactNode;
  tone?: MerIconTone;
}) {
  const { prefetch: prefetchHref } = usePrefetchOnIntent();
  return (
    <Link
      href={href}
      prefetch
      onPointerDown={() => prefetchHref(href)}
      onMouseEnter={() => prefetchHref(href)}
      onFocus={() => prefetchHref(href)}
      className="group flex min-h-[3.25rem] items-center gap-3 border-b border-[var(--numa-border)] px-4 py-3.5 last:border-b-0 numa-press hover:bg-[var(--numa-card)] active:bg-[var(--numa-accent-soft)]"
    >
      {icon ? <MerIcon tone={tone}>{icon}</MerIcon> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium tracking-tight text-[var(--numa-ink)]">
          {label}
        </span>
        {hint ? (
          <span className="mt-0.5 block truncate text-[12px] leading-snug text-[var(--numa-faint)]">
            {hint}
          </span>
        ) : null}
      </span>
      {trailing}
      <ChevronRight className="shrink-0 text-[var(--numa-faint)] transition group-hover:translate-x-0.5 group-hover:text-[var(--numa-accent)]" />
    </Link>
  );
}

export function MerListRow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border-b border-[var(--numa-border)] px-4 py-3.5 last:border-b-0 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export function MerMetaRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="numa-money-line min-h-[3rem] items-center border-b border-[var(--numa-border)] px-4 py-3 last:border-b-0">
      <dt className="numa-money-line-label text-[13px] text-[var(--numa-muted)]">
        {label}
      </dt>
      <dd className="numa-money-line-amt text-right text-[13px] font-medium tracking-tight text-[var(--numa-ink)]">
        {value}
      </dd>
    </div>
  );
}

function ChevronRight({ className = "" }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M6 3.5 10.5 8 6 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronLeft({ className = "" }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M10 3.5 5.5 8 10 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function iconProps() {
  return {
    width: 17,
    height: 17,
    viewBox: "0 0 20 20",
    fill: "none" as const,
    "aria-hidden": true,
  };
}

export function IconRorelser() {
  return (
    <svg {...iconProps()}>
      <path
        d="M5 4.5h10a1 1 0 0 1 1 1v9.6a.8.8 0 0 1-1.24.67l-1.1-.73a.8.8 0 0 0-.92.03l-.98.76a.8.8 0 0 1-.98 0l-.98-.76a.8.8 0 0 0-.98 0l-.98.76a.8.8 0 0 1-.98 0l-.98-.76a.8.8 0 0 0-.92-.03l-1.1.73A.8.8 0 0 1 4 15.1V5.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M7 8h6M7 10.6h6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconWallet() {
  return (
    <svg {...iconProps()}>
      <path
        d="M3.5 7.2a1.7 1.7 0 0 1 1.7-1.7h9.6a1.7 1.7 0 0 1 1.7 1.7v6.6a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7V7.2Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M12.2 10.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
        fill="currentColor"
      />
      <path d="M6 5.5 12 3.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconCamera() {
  return (
    <svg {...iconProps()}>
      <path
        d="M4 7.4a1 1 0 0 1 1-1h1.3l.7-1.3a1 1 0 0 1 .88-.5h4.24a1 1 0 0 1 .88.5l.7 1.3H15a1 1 0 0 1 1 1v6.9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7.4Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10.8" r="2.35" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function IconImages() {
  return (
    <svg {...iconProps()}>
      <rect
        x="3.6"
        y="4.6"
        width="10.8"
        height="9.4"
        rx="1.4"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="6.9" cy="7.9" r="1.1" fill="currentColor" />
      <path
        d="M5 12.6 8 9.9l1.7 1.5 2.4-2.5 3 3.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconGear() {
  return (
    <svg {...iconProps()}>
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10 3.6v1.6M10 14.8v1.6M16.4 10h-1.6M5.2 10H3.6M14.5 5.5l-1.13 1.13M6.63 13.37 5.5 14.5M14.5 14.5l-1.13-1.13M6.63 6.63 5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconWrench() {
  return (
    <svg {...iconProps()}>
      <path
        d="M12.1 4.4a3.1 3.1 0 0 0-3.9 3.9L4 12.5v2.1l1.4 1.4h2.1l4.2-4.2a3.1 3.1 0 0 0 3.9-3.9l-2 2-1.7-.5-.5-1.7 2-2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconLink() {
  return (
    <svg {...iconProps()}>
      <path
        d="M8.4 11.6a2.6 2.6 0 0 1 0-3.68l1.7-1.7a2.6 2.6 0 0 1 3.68 3.68l-.9.9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M11.6 8.4a2.6 2.6 0 0 1 0 3.68l-1.7 1.7a2.6 2.6 0 0 1-3.68-3.68l.9-.9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconPersonPlus() {
  return (
    <svg {...iconProps()}>
      <circle cx="8.1" cy="7.6" r="2.35" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3.7 15.5c.4-2.5 2.1-3.9 4.4-3.9s4 1.4 4.4 3.9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M15 6.6v3.4M13.3 8.3h3.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
