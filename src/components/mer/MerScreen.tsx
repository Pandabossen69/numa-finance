"use client";

import { SignOutButton } from "@/components/auth/SignOutButton";
import {
  MerListGroup,
  MerListLink,
  MerListRow,
  MerPageHeader,
  MerSection,
} from "@/components/mer/MerHub";
import { MerViewLoading } from "@/components/mer/MerViewLoading";
import { HomescreenInstallHint } from "@/components/pwa/HomescreenInstallHint";
import { SV } from "@/features/copy/labels-sv";
import {
  lastMerSnapshot,
  rememberMerSnapshot,
} from "@/features/home/last-snapshot";
import { PRODUCTION_HOST, PRODUCTION_ORIGIN } from "@/lib/site";
import { DestinationWarmup } from "@/lib/nav/prefetch-intent";

type MerItem = {
  href: string;
  label: string;
  hint?: string;
};

const sections: Array<{ title: string; items: MerItem[] }> = [
  {
    title: "Pengar",
    items: [
      { href: "/transaktioner", label: "Rörelser", hint: "Historik" },
      { href: "/konton", label: SV.saldo, hint: "Uppdatera belopp" },
    ],
  },
  {
    title: "Lägg till",
    items: [
      { href: "/fota", label: "Fota", hint: "Saldo eller kvitto" },
      { href: "/importera", label: "Tidigare bilder" },
    ],
  },
  {
    title: "App",
    items: [
      { href: "/installningar", label: "Inställningar" },
      { href: "/laga", label: "Laga appen", hint: "Om något strular" },
    ],
  },
];

export const MER_WARM_HREFS = [
  "/transaktioner",
  "/konton",
  "/fota",
  "/importera",
  "/installningar",
  "/laga",
  "/konton/ny",
] as const;

export function MerScreen({
  data,
}: {
  data: { displayName: string; isAdmin: boolean } | null;
}) {
  if (data) rememberMerSnapshot(data);
  const view = data ?? lastMerSnapshot();

  if (!view) return <MerViewLoading />;

  return (
    <div className="numa-page numa-page-wide min-w-0 overflow-x-hidden space-y-7">
      <DestinationWarmup hrefs={MER_WARM_HREFS} />
      <MerPageHeader
        title="Mer"
        description={`Inloggad som ${view.displayName}`}
      />

      <div className="animate-rise-delay-1 space-y-6">
        <MerSection title="På telefonen (alla konton)">
          <div className="md:hidden">
            <HomescreenInstallHint dismissible={false} />
          </div>
          <div className="pt-2">
            <MerListGroup>
              <MerListLink
                href={PRODUCTION_ORIGIN}
                label={PRODUCTION_HOST}
                hint="Samma länk för dig, familj och vänner"
              />
            </MerListGroup>
          </div>
        </MerSection>

        <nav className="space-y-6" aria-label="Mer-meny">
          {sections.map((section) => (
            <MerSection key={section.title} title={section.title}>
              <MerListGroup>
                {section.items.map((item) => (
                  <MerListLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    hint={item.hint}
                  />
                ))}
              </MerListGroup>
            </MerSection>
          ))}

          {view.isAdmin ? (
            <MerSection title="Administration">
              <MerListGroup>
                <MerListLink
                  href="/installningar/ny-anvandare"
                  label="Ny användare"
                  hint="Skapa inloggning. Börjar tomt."
                />
              </MerListGroup>
            </MerSection>
          ) : null}

          <MerSection title="Konto">
            <MerListGroup>
              <MerListRow>
                <p className="text-[15px] font-semibold tracking-tight">
                  {view.displayName}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--numa-faint)]">
                  Inloggad nu
                </p>
              </MerListRow>
              <MerListRow className="py-3">
                <p className="mb-2 text-[12px] leading-snug text-[var(--numa-faint)]">
                  Avslutar sessionen på den här enheten
                </p>
                <SignOutButton />
              </MerListRow>
            </MerListGroup>
          </MerSection>
        </nav>
      </div>
    </div>
  );
}
