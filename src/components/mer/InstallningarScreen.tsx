"use client";

import {
  MerListGroup,
  MerListLink,
  MerListRow,
  MerMetaRow,
  MerPageHeader,
  MerSection,
} from "@/components/mer/MerHub";
import { SettingsViewLoading } from "@/components/mer/MerViewLoading";
import { HomescreenInstallHint } from "@/components/pwa/HomescreenInstallHint";
import { RepairAppButton } from "@/components/pwa/RepairAppButton";
import {
  lastSettingsSnapshot,
  rememberSettingsSnapshot,
  type SettingsSnapshot,
} from "@/features/home/last-snapshot";

export function InstallningarScreen({
  data,
  profileMissing = false,
}: {
  data: SettingsSnapshot | null;
  profileMissing?: boolean;
}) {
  if (data) rememberSettingsSnapshot(data);
  const view = data ?? lastSettingsSnapshot();

  if (!view && !profileMissing) return <SettingsViewLoading />;

  return (
    <div className="numa-page numa-page-wide min-w-0 overflow-x-hidden space-y-7 text-[var(--numa-ink)]">
      <MerPageHeader back title="Inställningar" />

      <div className="animate-rise-delay-1 space-y-6">
        <div className="md:hidden">
          <MerSection title="På hemskärmen">
            <HomescreenInstallHint dismissible={false} />
          </MerSection>
        </div>

        <MerSection title="Underhåll">
          <MerListGroup>
            <MerListRow className="space-y-3 py-4">
              <div>
                <p className="text-[15px] font-medium tracking-tight">
                  Fungerar inte appen?
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--numa-faint)]">
                  Rensar cache och laddar om.
                </p>
              </div>
              <RepairAppButton />
            </MerListRow>
          </MerListGroup>
        </MerSection>

        {view?.isAdmin ? (
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

        <MerSection title="Profil">
          {view ? (
            <MerListGroup>
              <dl>
                <MerMetaRow label="Namn" value={view.displayName} />
                <MerMetaRow label="Tidszon" value={view.timezone} />
                <MerMetaRow label="Valuta" value={view.primaryCurrency} />
                <MerMetaRow
                  label="Dataläge"
                  value={view.supabaseReady ? "Moln (Supabase)" : "Lokal lagring"}
                />
              </dl>
            </MerListGroup>
          ) : (
            <MerListGroup>
              <MerListRow>
                <p className="text-sm text-[var(--numa-muted)]">
                  Kunde inte läsa profilen. Prova “Laga appen” ovan.
                </p>
              </MerListRow>
            </MerListGroup>
          )}
        </MerSection>
      </div>
    </div>
  );
}
