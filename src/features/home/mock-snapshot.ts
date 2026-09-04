import { greetingFirstName } from "@/domain/identity/display-name";
import { calculateSafeToSpend, DEFAULT_TIMEZONE } from "@/domain/finance";
import { calculateDayPulse } from "@/domain/gamification";
import { money, type CurrencyCode } from "@/domain/money";
import type { HomeSnapshot } from "@/features/finance/load-home";

/**
 * Realistic Hem mock for visual foundation.
 * Domain engines compute safe-to-spend + day pulse — UI does not invent math.
 */
export type HomeViewModel = HomeSnapshot & {
  dayPulseStatus: "plus" | "even" | "minus";
  dayPulseDeltaMinor: number;
  dayPulseUsedPercent: number;
  referenceSekApprox: number | null;
  mockMode: true;
};

const CURRENCY: CurrencyCode = "THB";

export function buildMockHomeViewModel(now = new Date()): HomeViewModel {
  const available = money(47_350_00, CURRENCY);
  const reserved = money(18_200_00, CURRENCY);
  const safetyBuffer = money(5_000_00, CURRENCY);
  const spentToday = money(420_00, CURRENCY);
  const daysUntilIncome = 11;
  const freePlan = 45_000_00 - reserved.amountMinor - 5_000_00;
  const cycleSpent = spentToday.amountMinor * 3;
  const remainingFree = freePlan - cycleSpent;

  const safe = calculateSafeToSpend({
    available,
    reserved,
    safetyBuffer,
    daysUntilNextIncome: daysUntilIncome,
    flexiblePlanRemaining: money(8_800_00, CURRENCY),
  });

  const afterSpend = calculateSafeToSpend({
    available: money(available.amountMinor - spentToday.amountMinor, CURRENCY),
    reserved,
    safetyBuffer,
    daysUntilNextIncome: daysUntilIncome,
    flexiblePlanRemaining: money(8_800_00 - spentToday.amountMinor, CURRENCY),
  });

  const dayBudget = Math.floor(freePlan / 21);
  const remainingToday = Math.max(0, dayBudget - spentToday.amountMinor);

  const pulse = calculateDayPulse({
    safeToSpendToday: money(dayBudget, CURRENCY),
    spentToday,
  });

  return {
    mockMode: true,
    userId: "mock-hugo",
    displayName: "Hugo",
    timeZone: DEFAULT_TIMEZONE,
    hasBankTruth: true,
    primaryAccountId: "mock-bangkok-bank",
    currency: CURRENCY,
    monthKey: "2026-08",
    monthLabelSv: "augusti 2026",
    calculatedBalanceMinor: available.amountMinor,
    verificationLabel: "I morse",
    todaySpendingMinor: spentToday.amountMinor,
    todayPlannedPaidMinor: 0,
    monthSpendingMinor: spentToday.amountMinor * 8,
    cycleSpendingMinor: cycleSpent,
    safeToSpendTodayMinor: afterSpend.today.amountMinor,
    planIncomeMinor: 45_000_00,
    planExpenseMinor: reserved.amountMinor,
    planSavingsMinor: 5_000_00,
    freeToSpendMinor: freePlan,
    remainingFreeMinor: remainingFree,
    spendDaysLeft: 21,
    dayBudgetMinor: dayBudget,
    remainingTodayMinor: remainingToday,
    cycleStartLabelSv: "25 aug.",
    cycleEndLabelSv: "25 sep.",
    cycleEndInferred: false,
    cycleIsActive: true,
    livingMode: "cycle",
    needsAvailableInput: false,
    usesBankBalance: false,
    nextIncomeLabelSv: "25 sep.",
    daysUntilIncome,
    extraSaldoMinor: 0,
    extraSaldoDrawnMinor: 0,
    extraSaldoHint: null,
    extraCarriedInMinor: 0,
    savingsTotalMinor: 5_000_00,
    wealthTotalMinor: remainingFree + 5_000_00,
    monthResultMinor: 0,
    incomingMinor: 0,
    unpaidMinor: reserved.amountMinor,
    overMinor: available.amountMinor - reserved.amountMinor,
    dayPulseStatus: pulse.status,
    dayPulseDeltaMinor: pulse.delta.amountMinor,
    dayPulseUsedPercent: pulse.usedPercent,
    referenceSekApprox: Math.round((available.amountMinor / 100) * 0.3),
    financeRevision: "mock-rev",
    verifiedAt: new Date().toISOString(),
    truthStatus: "verified",
  };
}

export function homeGreeting(
  displayName?: string,
  now = new Date(),
  timeZone = DEFAULT_TIMEZONE,
): string {
  const hour = zonedHour(now, timeZone);
  const hello = hour < 11 ? "God morgon" : hour < 18 ? "Hej" : "God kväll";
  const name = greetingFirstName(displayName);
  return name ? `${hello} ${name}` : hello;
}

function zonedHour(now: Date, timeZone: string): number {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  }).format(now);
  return Number.parseInt(formatted, 10);
}
