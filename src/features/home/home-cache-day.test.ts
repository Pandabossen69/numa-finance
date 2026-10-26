import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { HomeSnapshot } from "@/features/finance/load-home";
import {
  homeCacheDayEnvelope,
  msUntilNextZonedMidnight,
} from "./home-cache-day";

function home(partial: Partial<HomeSnapshot> = {}): HomeSnapshot {
  return {
    userId: "u1",
    displayName: "Hugo",
    timeZone: "Asia/Bangkok",
    primaryAccountId: "acc",
    currency: "THB",
    monthKey: "2026-10",
    monthLabelSv: "oktober",
    hasBankTruth: true,
    calculatedBalanceMinor: 14_593_300,
    verificationLabel: null,
    todaySpendingMinor: 0,
    todayPlannedPaidMinor: 0,
    monthSpendingMinor: 0,
    cycleSpendingMinor: 0,
    safeToSpendTodayMinor: 14_593_300,
    cycleStartLabelSv: "25 sep.",
    cycleEndLabelSv: "25 okt.",
    cycleEndInferred: false,
    cycleIsActive: false,
    livingMode: "bridge",
    needsAvailableInput: false,
    usesBankBalance: true,
    planIncomeMinor: 40_000_00,
    planExpenseMinor: 0,
    planSavingsMinor: 0,
    freeToSpendMinor: 40_000_00,
    remainingFreeMinor: 14_593_300,
    spendDaysLeft: 0,
    dayBudgetMinor: 14_593_300,
    remainingTodayMinor: 14_593_300,
    livingPoolMinor: 14_593_300,
    reservedUntilIncomeMinor: 0,
    daysUntilIncome: 0,
    nextIncomeLabelSv: "25 okt.",
    dayEnvelopeOpen: true,
    extraSaldoMinor: 0,
    extraSaldoDrawnMinor: 0,
    extraSaldoHint: null,
    extraCarriedInMinor: 0,
    savingsTotalMinor: 0,
    wealthTotalMinor: 14_593_300,
    monthResultMinor: 0,
    incomingMinor: 0,
    unpaidMinor: 0,
    overMinor: 14_593_300,
    financeRevision: "rev",
    verifiedAt: "2026-10-25T05:00:00.000Z",
    truthStatus: "verified",
    ...partial,
  };
}

const today = new Date("2026-10-26T05:00:00.000Z");

describe("homeCacheDayEnvelope", () => {
  it("drops yesterday's Kvar when that day was the horizon", () => {
    const next = homeCacheDayEnvelope(home(), today);
    expect(next.dayEnvelopeOpen).toBe(false);
    expect(next.dayEnvelopePending).toBe(false);
    expect(next.dayBudgetMinor).toBe(0);
    expect(next.remainingTodayMinor).toBe(0);
    expect(next.calculatedBalanceMinor).toBe(14_593_300);
    expect(next.livingMode).toBe("bridge");
  });

  it("hides a still-open envelope from another day without a zero or the old amount", () => {
    const next = homeCacheDayEnvelope(
      home({
        spendDaysLeft: 6,
        daysUntilIncome: 6,
        dayBudgetMinor: 275_12,
        remainingTodayMinor: 275_12,
        verifiedAt: "2026-10-25T05:00:00.000Z",
      }),
      today,
    );
    expect(next.dayEnvelopePending).toBe(true);
    expect(next.dayEnvelopeOpen).not.toBe(false);
    expect(next.dayBudgetMinor).toBe(0);
    expect(next.remainingTodayMinor).toBe(0);
    expect(next.calculatedBalanceMinor).toBe(14_593_300);
    expect(next.livingPoolMinor).toBe(14_593_300);
  });

  it("keeps today's envelope", () => {
    const snap = home({
      verifiedAt: "2026-10-26T02:00:00.000Z",
      spendDaysLeft: 4,
      dayBudgetMinor: 1_000_00,
      remainingTodayMinor: 800_00,
    });
    expect(homeCacheDayEnvelope(snap, today)).toBe(snap);
  });

  it("leaves an empty plan on yesterday's shell so Hem can still say there is no income", () => {
    const snap = home({
      livingMode: "empty",
      dayBudgetMinor: 0,
      remainingTodayMinor: 0,
      dayEnvelopeOpen: false,
    });
    expect(homeCacheDayEnvelope(snap, today)).toBe(snap);
    expect(homeCacheDayEnvelope(snap, today).livingMode).toBe("empty");
  });
});

describe("civil day roll wiring", () => {
  it("recomputes on visibility and the next local midnight, without a refresh", () => {
    const hem = readFileSync(
      new URL("../../components/home/HemRouteClient.tsx", import.meta.url),
      "utf8",
    );
    const store = readFileSync(
      new URL("./last-snapshot.ts", import.meta.url),
      "utf8",
    );
    expect(hem).toContain("bindHomeCivilDayRoll()");
    expect(hem).not.toContain("router.refresh");
    expect(store).toContain('document.addEventListener("visibilitychange"');
    expect(store).toContain("msUntilNextZonedMidnight");
    const roll = store.slice(
      store.indexOf("export function rollHomeLivingToNow"),
      store.indexOf("let civilDayTimer"),
    );
    expect(roll).not.toContain("revalidatePath");
    expect(roll).not.toContain("router.refresh");
  });
});

describe("msUntilNextZonedMidnight", () => {
  it("waits until Bangkok midnight, not UTC midnight", () => {
    const ten = new Date("2026-10-26T03:00:00.000Z");
    const wait = msUntilNextZonedMidnight(ten, "Asia/Bangkok");
    expect(wait).toBe(14 * 60 * 60 * 1000);
  });
});
