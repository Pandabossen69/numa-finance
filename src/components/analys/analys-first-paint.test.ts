import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { analysViewCanPaint } from "@/features/finance/analys-client-fetch";
import { ensurePaintableAnalysSnapshot } from "@/features/finance/ensure-analys-last-known";
import type { HomeSnapshot } from "@/features/finance/load-home";
import {
  clearClientSessionCaches,
  lastAnalysSnapshot,
  rememberHomeSnapshot,
} from "@/features/home/last-snapshot";

const route = readFileSync(new URL("./AnalysRouteClient.tsx", import.meta.url), "utf8");
const pending = readFileSync(
  new URL("../layout/ViewLoading.tsx", import.meta.url),
  "utf8",
);

const home = {
  userId: "user-hugo",
  displayName: "Hugo",
  timeZone: "Asia/Bangkok",
  primaryAccountId: "acc",
  currency: "THB",
  monthKey: "2026-09",
  monthLabelSv: "september",
  hasBankTruth: true,
  calculatedBalanceMinor: 10_000_00,
  verificationLabel: null,
  todaySpendingMinor: 200_00,
  todayPlannedPaidMinor: 0,
  monthSpendingMinor: 1_000_00,
  cycleSpendingMinor: 400_00,
  safeToSpendTodayMinor: 800_00,
  cycleStartLabelSv: "1 sep.",
  cycleEndLabelSv: "1 okt.",
  cycleEndInferred: false,
  cycleIsActive: true,
  livingMode: "cycle",
  needsAvailableInput: false,
  usesBankBalance: true,
  planIncomeMinor: 20_000_00,
  planExpenseMinor: 0,
  planSavingsMinor: 0,
  freeToSpendMinor: 20_000_00,
  remainingFreeMinor: 19_600_00,
  spendDaysLeft: 12,
  dayBudgetMinor: 1_000_00,
  remainingTodayMinor: 800_00,
  livingPoolMinor: 10_000_00,
  reservedUntilIncomeMinor: 0,
  daysUntilIncome: 12,
  nextIncomeLabelSv: null,
  extraSaldoMinor: 0,
  extraSaldoDrawnMinor: 0,
  extraSaldoHint: null,
  extraCarriedInMinor: 0,
  savingsTotalMinor: 0,
  wealthTotalMinor: 10_000_00,
  monthResultMinor: 0,
  incomingMinor: 0,
  unpaidMinor: 0,
  overMinor: 10_000_00,
  financeRevision: "rev-1",
  verifiedAt: "2026-09-19T05:00:00.000Z",
  truthStatus: "verified",
} as HomeSnapshot;

afterEach(() => {
  clearClientSessionCaches();
});

describe("Analys time-to-first-paint (not fetch-done)", () => {
  it("paints last-known / Hem-derived chrome without awaiting the action", () => {
    const body = route.slice(route.indexOf("export function AnalysRouteClient"));
    const viewIdx = body.indexOf("const view =");
    const fetchIdx = body.indexOf("fetchAnalysSnapshotClient");
    expect(viewIdx).toBeGreaterThan(-1);
    expect(fetchIdx).toBeGreaterThan(viewIdx);
    expect(route).toContain("if (ensurePaintableAnalysSnapshot()) return");
    expect(route).toContain("<AnalysDashboard data={view}");
    expect(route).not.toContain("waitForQuietMenuWarm");
    expect(route).not.toContain("await getAnalysSnapshotAction");
  });

  it("writes paint-able last-known when Hem confirms — before Analys fetch", () => {
    expect(lastAnalysSnapshot()).toBeNull();
    rememberHomeSnapshot(home);
    expect(analysViewCanPaint(lastAnalysSnapshot())).toBe(true);
    expect(lastAnalysSnapshot()?.cycle.remainingFreeMinor).toBe(
      home.remainingFreeMinor,
    );
    expect(lastAnalysSnapshot()?.cycle.daysLeft).toBe(home.spendDaysLeft);
    const again = ensurePaintableAnalysSnapshot();
    expect(again?.cycle.remainingFreeMinor).toBe(home.remainingFreeMinor);
  });

  it("keeps Perioden / Månad chrome on the empty shell", () => {
    const pendingFn = pending.slice(
      pending.indexOf("export function AnalysPending"),
      pending.indexOf("export function AnalysViewLoading"),
    );
    expect(pendingFn).toContain("SV.perioden");
    expect(pendingFn).toContain("SV.manad");
    expect(pendingFn).toContain("data-numa-view-loading");
  });
});
