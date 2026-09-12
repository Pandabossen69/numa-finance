import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

describe("quiet menu warm — NextStep-style last-known fill", () => {
  it("schedules idle warm from Hem without racing adopt on warmupPlanPageData", () => {
    const warm = read("./quiet-menu-warm.ts");
    const home = read("../../components/home/HomeDashboard.tsx");
    expect(warm).toContain("getQuietMenuBundleAction");
    expect(warm).toContain("requestIdleCallback");
    expect(warm).toContain("opts?.urgent");
    expect(warm).toContain("rememberPlanSnapshot");
    expect(warm).toContain("rememberAnalysSnapshot");
    expect(warm).toContain("rememberMovementsSnapshot");
    expect(warm).toContain("isMovementsDirty");
    expect(warm).toContain("opts?.restart");
    expect(home).toContain("scheduleQuietMenuWarm");
    const adoptStart = home.indexOf("useEffect(() => {");
    const adoptEnd = home.indexOf("}, [snap, accounts, gettingStarted]);");
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
    expect(client).toContain("afterHemBoot");
    expect(client).toContain("if (lastMovementsSnapshot()) return;");
    expect(client).toContain("if (!lastMovementsSnapshot()) setError");
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
