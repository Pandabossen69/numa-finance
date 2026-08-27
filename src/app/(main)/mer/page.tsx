import { SignOutButton } from "@/components/auth/SignOutButton";
import { HomescreenInstallHint } from "@/components/pwa/HomescreenInstallHint";
import { getProfile } from "@/lib/store/repository";
import { PRODUCTION_HOST, PRODUCTION_ORIGIN } from "@/lib/site";
import { SV } from "@/features/copy/labels-sv";
import { currentUserIsNumaAdmin } from "@/features/auth/session";
import {
  MerListGroup,
  MerListLink,
  MerListRow,
  MerPageHeader,
  MerSection,
} from "@/components/mer/MerHub";

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
      { href: "/fota", label: "Fota", hint: "SMS eller kvitto" },
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

export default async function MerPage() {
  let displayName = "Användare";
  try {
    displayName = (await getProfile()).displayName;
  } catch (error) {
    console.error("[numa] mer profile failed", error);
  }
  const isAdmin = await currentUserIsNumaAdmin();

  return (
    <div className="numa-page numa-page-wide space-y-7">
      <MerPageHeader title="Mer" description={`Inloggad som ${displayName}`} />

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

          {isAdmin ? (
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
                <p className="text-[15px] font-semibold tracking-tight">{displayName}</p>
                <p className="mt-0.5 text-[12px] text-[var(--numa-faint)]">Inloggad nu</p>
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
