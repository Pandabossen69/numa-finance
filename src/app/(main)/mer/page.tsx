import { SignOutButton } from "@/components/auth/SignOutButton";
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
      { href: "/konton", label: "Saldo", hint: "Uppdatera belopp" },
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

export default function MerPage() {
  return (
    <div className="mx-auto max-w-lg space-y-7">
      <MerPageHeader title="Mer" />

      <nav className="animate-rise-delay-1 space-y-6" aria-label="Mer-meny">
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

        <MerSection title="Konto">
          <MerListGroup>
            <MerListRow className="py-3">
              <SignOutButton />
            </MerListRow>
          </MerListGroup>
        </MerSection>
      </nav>
    </div>
  );
}
