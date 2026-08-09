"use client";

import Link from "next/link";

export function AuthStage({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-stage relative flex min-h-dvh flex-col overflow-hidden">
      <div className="auth-glow" aria-hidden />
      <div className="numa-shell relative z-10 flex flex-1 flex-col px-5 pt-[max(1.5rem,var(--numa-safe-top))] pb-[max(1.5rem,var(--numa-safe-bottom))]">
        {children}
      </div>
    </div>
  );
}

export function BackButton({
  onClick,
  href,
}: {
  onClick?: () => void;
  href?: string;
}) {
  const className =
    "inline-flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-[var(--numa-muted)]";
  const label = (
    <>
      <span aria-hidden className="text-lg leading-none">
        ←
      </span>
      Tillbaka
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} aria-label="Tillbaka">
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} aria-label="Tillbaka">
      {label}
    </button>
  );
}

export function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="mt-4 flex gap-1.5" aria-label={`Steg ${current} av ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1 rounded-full transition-all ${
            i + 1 === current
              ? "w-6 bg-[var(--numa-accent)]"
              : i + 1 < current
                ? "w-4 bg-[var(--numa-accent)]/50"
                : "w-4 bg-[var(--numa-border)]"
          }`}
        />
      ))}
    </div>
  );
}

export function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  autoFocus,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-medium text-[var(--numa-muted)]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required
        className="min-h-14 w-full rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-4 text-[16px] outline-none transition focus:border-[var(--numa-accent)] focus:ring-2 focus:ring-[var(--numa-accent)]/25"
      />
    </label>
  );
}

export function PasswordField({
  label,
  value,
  show,
  onChange,
  onToggle,
  autoComplete,
  autoFocus,
}: {
  label: string;
  value: string;
  show: boolean;
  onChange: (v: string) => void;
  onToggle: () => void;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-medium text-[var(--numa-muted)]">
        {label}
      </span>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          minLength={8}
          className="min-h-14 w-full rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-4 pr-20 text-[16px] outline-none transition focus:border-[var(--numa-accent)] focus:ring-2 focus:ring-[var(--numa-accent)]/25"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg px-2 py-1.5 text-sm font-medium text-[var(--numa-accent)]"
        >
          {show ? "Dölj" : "Visa"}
        </button>
      </div>
    </label>
  );
}

export function PrimaryButton({
  children,
  disabled,
  type = "submit",
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-14 w-full items-center justify-center rounded-[1.25rem] bg-[var(--numa-accent)] text-[15px] font-semibold text-white transition enabled:active:scale-[0.99] disabled:opacity-45"
    >
      {children}
    </button>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="rounded-2xl bg-[color-mix(in_srgb,var(--numa-danger)_12%,transparent)] px-3 py-2.5 text-sm leading-relaxed text-[var(--numa-danger)]"
      role="alert"
    >
      {children}
    </p>
  );
}

export function NoticeText({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="rounded-2xl bg-[color-mix(in_srgb,var(--numa-accent)_12%,transparent)] px-3 py-2.5 text-sm leading-relaxed text-[var(--numa-ink)]"
      role="status"
    >
      {children}
    </p>
  );
}
