"use client";

import Link from "next/link";
import { ONBOARDING_SV as C } from "@/features/onboarding/copy";
import {
  ONBOARDING_FOTA_PATH,
  ONBOARDING_MANUAL_PATH,
} from "@/features/onboarding/paths";

export function OnboardingSaldoChoice() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-7 animate-rise md:flex-none md:w-full">
      <header className="space-y-2.5 px-0.5">
        <p className="numa-section-title">{C.saldoEyebrow}</p>
        <h1 className="numa-page-title">{C.saldoTitle}</h1>
        <p className="max-w-[34ch] text-[15px] leading-relaxed text-[var(--numa-muted)]">
          {C.saldoHint}
        </p>
      </header>

      <nav className="mt-auto grid min-w-0 gap-3.5 pb-[max(0.25rem,env(safe-area-inset-bottom,0px))] md:mt-9 md:grid-cols-2 md:gap-4">
        <ChoiceLink
          index="01"
          href={ONBOARDING_FOTA_PATH}
          title={C.fotaTitle}
          hint={C.fotaHint}
        />
        <ChoiceLink
          index="02"
          href={ONBOARDING_MANUAL_PATH}
          title={C.manualTitle}
          hint={C.manualHint}
        />
      </nav>
    </div>
  );
}

function ChoiceLink({
  index,
  href,
  title,
  hint,
}: {
  index: string;
  href: string;
  title: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="numa-press group flex min-h-[5.25rem] w-full min-w-0 items-center gap-3.5 overflow-hidden rounded-[1.6rem] border border-[var(--numa-border-strong)] bg-[var(--numa-surface-solid)] px-3.5 py-3.5 text-left shadow-[var(--numa-shadow-sm)] transition hover:-translate-y-0.5 hover:bg-[var(--numa-card)] hover:shadow-[var(--numa-shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)] focus-visible:ring-offset-2 md:min-h-36 md:items-start md:px-5 md:py-5"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--numa-accent-soft)] text-[11px] font-bold tracking-[0.08em] text-[var(--numa-accent-ink)] md:h-11 md:w-11"
        aria-hidden
      >
        {index}
      </span>
      <span className="min-w-0 flex-1 md:pt-0.5">
        <span className="block text-[16px] font-[650] tracking-[-0.025em]">
          {title}
        </span>
        <span className="mt-1 block text-[13px] leading-relaxed text-[var(--numa-muted)]">
          {hint}
        </span>
      </span>
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-semibold text-[var(--numa-accent)] transition group-hover:translate-x-0.5 group-hover:bg-[var(--numa-accent-soft)] md:mt-auto"
        aria-hidden
      >
        →
      </span>
    </Link>
  );
}
