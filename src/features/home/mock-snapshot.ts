import { calculateSafeToSpend } from "@/domain/finance";
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
    hasBankTruth: true,
    primaryAccountId: "mock-bangkok-bank",
    currency: CURRENCY,
    monthKey: "2026-08",
    monthLabelSv: "augusti 2026",
    calculatedBalanceMinor: available.amountMinor,
    verificationLabel: "I morse",
    todaySpendingMinor: spentToday.amountMinor,
    monthSpendingMinor: spentToday.amountMinor * 8,
    cycleSpendingMinor: cycleSpent,
    safeToSpendTodayMinor: afterSpend.today.amountMinor,
    planIncomeMinor: 45_000_00,
    planExpenseMinor: reserved.amountMinor,
    planSavingsMinor: 5_000_00,
    freeToSpendMinor: freePlan,
    remainingFreeMinor: remainingFree,
    spendDaysLeft: 21,
    perDayBudgetMinor: remainingToday,
    dayBudgetMinor: dayBudget,
    cycleStartLabelSv: "25 aug.",
    cycleEndLabelSv: "25 sep.",
    cycleEndInferred: false,
    cycleIsActive: true,
    livingMode: "cycle",
    needsAvailableInput: false,
    usesBankBalance: false,
    nextIncomeLabelSv: "25 sep.",
    daysUntilIncome,
    dayPulseStatus: pulse.status,
    dayPulseDeltaMinor: pulse.delta.amountMinor,
    dayPulseUsedPercent: pulse.usedPercent,
    referenceSekApprox: Math.round((available.amountMinor / 100) * 0.3),
  };
}

export function homeGreeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 11) return "God morgon";
  if (hour < 18) return "Hej";
  return "God kväll";
}
