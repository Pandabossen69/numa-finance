"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { useNavIntent } from "@/components/layout/NavIntent";
import { isHoldRoot } from "@/components/layout/nav";
import { usePrefetchOnIntent } from "@/lib/nav/prefetch-intent";

export function MerBackLink({
  href = "/mer",
  label = "Mer",
}: {
  href?: string;
  label?: string;
}) {
  const { prefetch: prefetchHref } = usePrefetchOnIntent();
  const { markIntent } = useNavIntent();
  return (
    <Link
      href={href}
      prefetch={false}
      onPointerDown={() => {
        prefetchHref(href);
        if (isHoldRoot(href)) markIntent(href);
      }}
      onMouseEnter={() => prefetchHref(href)}
      onFocus={() => prefetchHref(href)}
      onClick={() => {
        if (isHoldRoot(href)) markIntent(href);
      }}
      className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-[var(--numa-muted)] transition hover:text-[var(--numa-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)] focus-visible:ring-offset-2"
    >
      <Icon icon={ChevronLeft} className="opacity-70" />
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
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--numa-radius)] ${MER_ICON_TONE_CLASS[tone]}`}
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
  const { markIntent } = useNavIntent();
  return (
    <Link
      href={href}
      prefetch={false}
      onPointerDown={() => {
        prefetchHref(href);
        if (isHoldRoot(href)) markIntent(href);
      }}
      onMouseEnter={() => prefetchHref(href)}
      onFocus={() => prefetchHref(href)}
      onClick={() => {
        if (isHoldRoot(href)) markIntent(href);
      }}
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
      <Icon
        icon={ChevronRight}
        className="shrink-0 text-[var(--numa-faint)] transition group-hover:translate-x-0.5 group-hover:text-[var(--numa-accent)]"
      />
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

