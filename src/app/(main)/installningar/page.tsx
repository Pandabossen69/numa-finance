import {
  MerListGroup,
  MerListLink,
  MerListRow,
  MerMetaRow,
  MerPageHeader,
  MerSection,
} from "@/components/mer/MerHub";
import { HomescreenInstallHint } from "@/components/pwa/HomescreenInstallHint";
import { RepairAppButton } from "@/components/pwa/RepairAppButton";
import { getProfile } from "@/lib/store/repository";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { currentUserIsNumaAdmin } from "@/features/auth/session";

export default async function InstallningarPage() {
  let profile: Awaited<ReturnType<typeof getProfile>> | null = null;
  try {
    profile = await getProfile();
  } catch (error) {
    console.error("[numa] installningar failed", error);
  }
  const supabaseReady = isSupabaseConfigured();
  const isAdmin = await currentUserIsNumaAdmin();

  return (
    <div className="numa-page numa-page-wide space-y-7 text-[var(--numa-ink)]">
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

        <MerSection title="Profil">
          {profile ? (
            <MerListGroup>
              <dl>
                <MerMetaRow label="Namn" value={profile.displayName} />
                <MerMetaRow label="Tidszon" value={profile.timezone} />
                <MerMetaRow label="Valuta" value={profile.primaryCurrency} />
                <MerMetaRow
                  label="Dataläge"
                  value={supabaseReady ? "Moln (Supabase)" : "Lokal lagring"}
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
