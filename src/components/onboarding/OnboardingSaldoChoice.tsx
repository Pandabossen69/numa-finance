"use client";

import Link from "next/link";
import { ONBOARDING_SV as C } from "@/features/onboarding/copy";
import {
  ONBOARDING_FOTA_PATH,
  ONBOARDING_MANUAL_PATH,
} from "@/features/onboarding/paths";

export function OnboardingSaldoChoice() {
  return (
    <div className="numa-page animate-rise space-y-8">
      <header className="space-y-2">
        <p className="numa-section-title">{C.saldoEyebrow}</p>
        <h1 className="numa-page-title">{C.saldoTitle}</h1>
        <p className="max-w-[32ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          {C.saldoHint}
        </p>
      </header>

      <nav className="grid gap-3 md:grid-cols-2">
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
      className="numa-panel numa-press flex min-h-20 w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:border-[var(--numa-border-strong)] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--numa-accent)]"
    >
      <span>
        <span className="block text-[15px] font-semibold tracking-tight">
          {title}
        </span>
        <span className="mt-0.5 block text-sm leading-snug text-[var(--numa-muted)]">
          {hint}
        </span>
      </span>
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--numa-accent-soft)] text-sm font-semibold text-[var(--numa-accent-ink)]"
        aria-hidden
      >
        →
      </span>
    </Link>
  );
}
