import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const choice = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const fota = readFileSync(new URL("./fota/page.tsx", import.meta.url), "utf8");
const manual = readFileSync(
  new URL("./manuellt/page.tsx", import.meta.url),
  "utf8",
);
const onboardingLayout = readFileSync(
  new URL("../layout.tsx", import.meta.url),
  "utf8",
);
const choiceUi = readFileSync(
  new URL(
    "../../../components/onboarding/OnboardingSaldoChoice.tsx",
    import.meta.url,
  ),
  "utf8",
);
const manualUi = readFileSync(
  new URL(
    "../../../components/onboarding/OnboardingManualSaldo.tsx",
    import.meta.url,
  ),
  "utf8",
);
const mainLayout = readFileSync(
  new URL("../../(main)/layout.tsx", import.meta.url),
  "utf8",
);
const middleware = readFileSync(
  new URL("../../../lib/supabase/middleware.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260827115205_profile_onboarding.sql",
    import.meta.url,
  ),
  "utf8",
);
const checklistMigration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260827120238_getting_started_checklist.sql",
    import.meta.url,
  ),
  "utf8",
);
const finance = readFileSync(
  new URL("../../../features/finance/actions.ts", import.meta.url),
  "utf8",
);
const imports = readFileSync(
  new URL("../../../features/imports/actions.ts", import.meta.url),
  "utf8",
);
const idag = readFileSync(
  new URL("../../(main)/idag/page.tsx", import.meta.url),
  "utf8",
);
const adminPage = readFileSync(
  new URL("../../(main)/installningar/ny-anvandare/page.tsx", import.meta.url),
  "utf8",
);

describe("first-run onboarding", () => {
  it("keeps /kom-igang authenticated (not a public path)", () => {
    expect(middleware).toContain('"/logga-in"');
    expect(middleware).not.toContain("/kom-igang");
  });

  it("sends incomplete users away from the main shell", () => {
    expect(mainLayout).toContain("redirectIfOnboardingIncomplete");
    expect(onboardingLayout).not.toContain("BottomNav");
    expect(onboardingLayout).not.toContain("AppShell");
    expect(onboardingLayout).toContain("Logga ut");
    expect(onboardingLayout).toContain("max-w-lg");
  });

  it("requires saldo with two equal actions and no skip", () => {
    expect(choice).toContain("requireSaldoOnboardingPage");
    expect(choiceUi).toContain("ONBOARDING_FOTA_PATH");
    expect(choiceUi).toContain("ONBOARDING_MANUAL_PATH");
    expect(choiceUi).toContain("C.fotaTitle");
    expect(choiceUi).toContain("C.manualTitle");
    expect(choiceUi).not.toContain("Hoppa över");
    expect(choiceUi).not.toContain("Analys");
  });

  it("reuses Fota capture and the Hem saldo write, then lands on Hem", () => {
    expect(fota).toContain("ReceiptCaptureFlow");
    expect(fota).toContain('variant="onboarding"');
    expect(fota).toContain("fromOnboarding");
    expect(fota).toContain("successHref={HOME_PATH}");
    expect(manual).toContain("OnboardingManualSaldo");
    expect(manualUi).toContain("setAvailableNowAction");
    expect(manualUi).toContain("fromOnboarding: true");
    expect(manualUi).toContain("accountName");
    expect(manualUi).toContain("HOME_PATH");
    expect(finance).toContain("fromOnboarding");
    expect(finance).toContain("stampOnboardingSaldoAt");
    expect(finance).toContain("stampOnboardingCompletedAt");
    expect(finance).toContain("accountName");
    expect(imports).toContain("fromOnboarding");
    expect(imports).toContain("stampOnboardingSaldoAt");
    expect(imports).toContain("stampOnboardingCompletedAt");
  });

  it("adds profile onboarding timestamps without touching RLS", () => {
    expect(migration).toContain("onboarding_saldo_at");
    expect(migration).toContain("onboarding_completed_at");
    expect(migration).toContain("alter table numa.profiles");
    expect(migration).not.toContain("drop policy");
  });

  it("keeps Kom igång as a Hem checklist, not a feature tour", () => {
    expect(idag).toContain("loadGettingStartedView");
    expect(checklistMigration).toContain("getting_started_completed_at");
    expect(checklistMigration).toContain("getting_started_collapsed");
    expect(checklistMigration).not.toContain("drop policy");
  });

  it("keeps Ny användare as a centered card", () => {
    expect(adminPage).toContain("max-w-lg");
    expect(adminPage).toContain("CreateUserForm");
  });
});
