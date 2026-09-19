import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import type { AccountsSnapshot } from "@/features/finance/load-accounts";
import {
  clearClientSessionCaches,
  lastAccountsSnapshot,
  rememberAccountsSnapshot,
} from "@/features/home/last-snapshot";
import {
  applyQuietMenuBundleForTests,
  quietMenuCacheReady,
  resetQuietMenuWarmForTests,
} from "./quiet-menu-warm";

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

const sampleAccounts: AccountsSnapshot = {
  accounts: [
    {
      id: "acc-1",
      name: "Bangkok Bank",
      institution: null,
      maskedIdentifier: null,
      kind: "thai_bank",
      kindLabelSv: "Thai-bank",
      currency: "THB",
      isDefault: true,
      isActive: true,
      calculatedMinor: 1_200_00,
      thbMinor: 1_200_00,
      fxRate: null,
      fxSource: null,
    },
  ],
  archivedAccounts: [],
  totalThbMinor: 1_200_00,
};

describe("quiet menu warm — NextStep-style last-known fill", () => {
  beforeEach(() => {
    resetQuietMenuWarmForTests();
    clearClientSessionCaches();
  });

  it("schedules idle warm from Hem without racing adopt on warmupPlanPageData", () => {
    const warm = read("./quiet-menu-warm.ts");
    const home = read("../../components/home/HomeDashboard.tsx");
    expect(warm).toContain("getQuietMenuBundleAction");
    expect(warm).toContain("requestIdleCallback");
    expect(warm).toContain("rememberPlanSnapshot");
    expect(warm).toContain("rememberAnalysSnapshot");
    expect(warm).toContain("rememberMovementsSnapshot");
    expect(warm).toContain("rememberAccountsSnapshot");
    expect(warm).toContain("isMovementsDirty");
    expect(warm).toContain("isAccountsDirty");
    expect(warm).toContain("lastAccountsSnapshot() == null");
    expect(warm).toContain("opts?.restart");
    expect(home).toContain("scheduleQuietMenuWarm");
    const adoptStart = home.indexOf("useEffect(() => {");
    const adoptEnd = home.indexOf("}, [snap, accounts, gettingStarted, adoptSnap]);");
    expect(adoptStart).toBeGreaterThan(-1);
    expect(adoptEnd).toBeGreaterThan(adoptStart);
    const adopt = home.slice(adoptStart, adoptEnd);
    expect(adopt).toContain("scheduleQuietMenuWarm");
    expect(adopt).not.toContain("warmupPlanPageData");
  });

  it("keeps Transaktioner client-first with a dest-shaped loading shell", () => {
    const page = read("../../app/(main)/transaktioner/page.tsx");
    const loading = read("../../app/(main)/transaktioner/loading.tsx");
    const client = read("../../components/movements/MovementsRouteClient.tsx");
    expect(page).toContain("MovementsRouteClient");
    expect(page).not.toContain("loadMovementsSnapshot");
    expect(loading).toContain("LoadingSlot");
    expect(loading).toContain("MovementsScreen");
    expect(loading).not.toContain("MovementsViewLoading");
    expect(client).toContain("getMovementsSnapshotAction");
    expect(client).toContain("lastMovementsSnapshot");
    expect(client).toContain("if (lastMovementsSnapshot()) return;");
    expect(client).toContain("if (!lastMovementsSnapshot()) setError");
  });

  it("gap-fills lastAccountsSnapshot from the Plan TodaySnapshot so dest shell can paint", () => {
    const bundle = read("../../features/finance/quiet-menu-bundle.ts");
    expect(bundle).toContain("accounts: AccountsSnapshot | null");
    expect(bundle).toContain("accounts: plan?.accounts ?? null");
    expect(bundle).not.toMatch(/import \{[^}]*loadAccountsSnapshot/);
    expect(bundle).not.toContain("await loadAccounts");

    expect(lastAccountsSnapshot()).toBeNull();
    expect(quietMenuCacheReady()).toBe(false);

    applyQuietMenuBundleForTests({
      ok: true,
      data: {
        plan: null,
        gettingStarted: null,
        analys: null,
        movements: null,
        accounts: sampleAccounts,
      },
    });
    expect(lastAccountsSnapshot()?.accounts[0]?.name).toBe("Bangkok Bank");
    expect(lastAccountsSnapshot()?.totalThbMinor).toBe(1_200_00);
    expect(quietMenuCacheReady()).toBe(true);

    applyQuietMenuBundleForTests({
      ok: true,
      data: {
        plan: null,
        gettingStarted: null,
        analys: null,
        movements: null,
        accounts: {
          ...sampleAccounts,
          totalThbMinor: 99_00,
          accounts: [
            { ...sampleAccounts.accounts[0]!, name: "Should not clobber" },
          ],
        },
      },
    });
    expect(lastAccountsSnapshot()?.accounts[0]?.name).toBe("Bangkok Bank");
    expect(lastAccountsSnapshot()?.totalThbMinor).toBe(1_200_00);
  });

  it("does not overwrite a dirty accounts last-known from quiet warm", () => {
    rememberAccountsSnapshot(
      { ...sampleAccounts, totalThbMinor: 50_00 },
      { dirty: true },
    );
    applyQuietMenuBundleForTests({
      ok: true,
      data: {
        plan: null,
        gettingStarted: null,
        analys: null,
        movements: null,
        accounts: sampleAccounts,
      },
    });
    expect(lastAccountsSnapshot()?.totalThbMinor).toBe(50_00);
  });

  it("bounds the Rörelser ledger read to the plan history window", () => {
    const load = read("../../features/finance/load-movements.ts");
    expect(load).toContain("MOVEMENTS_LEDGER_SINCE_ISO");
    expect(load).toContain("MOVEMENTS_LEDGER_LIMIT");
    expect(load).toContain("sinceIso: MOVEMENTS_LEDGER_SINCE_ISO");
    expect(load).toContain("limit: MOVEMENTS_LEDGER_LIMIT");
    expect(load).not.toMatch(/listTransactions\(\s*\)/);
  });

  it("paints Plan loading as last-known PlanScreen, not a bare spinner", () => {
    const loading = read("../../app/(main)/plan/loading.tsx");
    expect(loading).toContain("LoadingSlot");
    expect(loading).toContain("PlanScreen");
    expect(loading).not.toContain("ViewLoading");
  });
});
