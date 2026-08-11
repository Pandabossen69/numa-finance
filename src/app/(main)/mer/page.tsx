import {
  MerListGroup,
  MerListLink,
  MerPageHeader,
  MerSection,
} from "@/components/mer/MerHub";

const sections = [
  {
    title: "Pengar",
    items: [
      {
        href: "/transaktioner",
        label: "Rörelser",
        hint: "SMS, kvitton och manuella belopp",
      },
      {
        href: "/konton",
        label: "Saldo",
        hint: "Bankens sanning · checkpoint",
      },
    ],
  },
  {
    title: "Infångning",
    items: [
      {
        href: "/fota",
        label: "Lägg till",
        hint: "Fota bank-SMS eller kvitto",
      },
      {
        href: "/importera",
        label: "Tidigare bilder",
        hint: "Uppladdade SMS och kvitton",
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        href: "/installningar",
        label: "Inställningar",
        hint: "Tidszon och underhåll",
      },
      {
        href: "/laga",
        label: "Laga appen",
        hint: "Rensa cache om något strular",
      },
    ],
  },
] as const;

export default function MerPage() {
  return (
    <div className="mx-auto max-w-lg space-y-7">
      <MerPageHeader
        title="Mer"
        description="Saldo, historik och underhåll — allt som håller Hem skarp."
      />

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
      </nav>
    </div>
  );
}
