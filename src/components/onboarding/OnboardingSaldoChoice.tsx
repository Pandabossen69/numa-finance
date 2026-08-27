"use client";

import Link from "next/link";
import { ONBOARDING_SV as C } from "@/features/onboarding/copy";
import {
  ONBOARDING_FOTA_PATH,
  ONBOARDING_MANUAL_PATH,
} from "@/features/onboarding/paths";

export function OnboardingSaldoChoice() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 animate-rise md:flex-none md:w-full">
      <header className="space-y-2 px-0.5">
        <p className="numa-section-title">{C.saldoEyebrow}</p>
        <h1 className="numa-page-title">{C.saldoTitle}</h1>
        <p className="max-w-[32ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          {C.saldoHint}
        </p>
      </header>

      <nav className="mt-auto grid min-w-0 gap-3 pb-1 md:mt-8 md:grid-cols-2 md:gap-4">
        <ChoiceLink
          href={ONBOARDING_FOTA_PATH}
          title={C.fotaTitle}
          hint={C.fotaHint}
        />
        <ChoiceLink
          href={ONBOARDING_MANUAL_PATH}
          title={C.manualTitle}
          hint={C.manualHint}
        />
      </nav>
    </div>
  );
}

function ChoiceLink({
  href,
  title,
  hint,
}: {
  href: string;
  title: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="numa-panel numa-press flex min-h-[4.5rem] w-full min-w-0 items-center justify-between gap-4 overflow-hidden px-4 py-4 text-left transition hover:border-[var(--numa-border-strong)] hover:bg-[var(--numa-card)] hover:shadow-[var(--numa-shadow-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)] focus-visible:ring-offset-2 md:min-h-32 md:px-5"
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold tracking-tight">
          {title}
        </span>
        <span className="mt-0.5 block text-sm leading-snug text-[var(--numa-muted)]">
          {hint}
        </span>
      </span>
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--numa-accent-soft)] text-sm font-semibold text-[var(--numa-accent-ink)]"
        aria-hidden
      >
        →
      </span>
    </Link>
  );
}
