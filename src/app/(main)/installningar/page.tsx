import { SignOutButton } from "@/components/auth/SignOutButton";
import {
  MerListGroup,
  MerListRow,
  MerMetaRow,
  MerPageHeader,
  MerSection,
} from "@/components/mer/MerHub";
import { HomescreenInstallHint } from "@/components/pwa/HomescreenInstallHint";
import { RepairAppButton } from "@/components/pwa/RepairAppButton";
import { getProfile } from "@/lib/store/repository";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function InstallningarPage({
  searchParams,
}: {
  searchParams: Promise<{ laga?: string }>;
}) {
  const params = await searchParams;
  const autoLaga = params.laga === "1";

  let profile: Awaited<ReturnType<typeof getProfile>> | null = null;
  try {
    profile = await getProfile();
  } catch (error) {
    console.error("[numa] installningar failed", error);
  }
  const supabaseReady = isSupabaseConfigured();

  return (
    <div className="mx-auto max-w-lg space-y-7 text-[var(--numa-ink)]">
      <MerPageHeader back title="Inställningar" />

      <div className="animate-rise-delay-1 space-y-6">
        <MerSection title="På hemskärmen">
          <HomescreenInstallHint dismissible={false} />
        </MerSection>

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
              <RepairAppButton autoStart={autoLaga} />
            </MerListRow>
          </MerListGroup>
        </MerSection>

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

        <MerSection title="Konto">
          <MerListGroup>
            <MerListRow className="py-3">
              <SignOutButton />
            </MerListRow>
          </MerListGroup>
        </MerSection>
      </div>
    </div>
  );
}
