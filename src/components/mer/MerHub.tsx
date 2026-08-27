import Link from "next/link";
import type { ReactNode } from "react";

export function MerBackLink({
  href = "/mer",
  label = "Mer",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      prefetch
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
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="numa-page-title">{title}</h1>
          {description ? (
            <p className="mt-1.5 max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0 pb-0.5">{action}</div> : null}
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

export function MerListLink({
  href,
  label,
  hint,
  trailing,
}: {
  href: string;
  label: string;
  hint?: string;
  trailing?: ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch
      className="group numa-press flex min-h-[3.25rem] items-center gap-3 border-b border-[var(--numa-border)] px-4 py-3.5 last:border-b-0 hover:bg-white/70 active:bg-[var(--numa-accent-soft)] [&:last-child]:border-b-0"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium tracking-tight text-[var(--numa-ink)]">
          {label}
        </span>
        {hint ? (
          <span className="mt-0.5 block text-[12px] leading-snug text-[var(--numa-faint)]">
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
    <div className="flex min-h-[3rem] items-center justify-between gap-4 border-b border-[var(--numa-border)] px-4 py-3 last:border-b-0">
      <dt className="text-[13px] text-[var(--numa-muted)]">{label}</dt>
      <dd className="text-right text-[13px] font-medium tracking-tight text-[var(--numa-ink)]">
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
