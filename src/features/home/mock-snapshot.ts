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

  const pulse = calculateDayPulse({
    safeToSpendToday: safe.today,
    spentToday,
  });

  const hour = now.getHours();
  const greeting =
    hour < 11 ? "God morgon" : hour < 18 ? "Hej" : "God kväll";

  void greeting;

  return {
    mockMode: true,
    hasBankTruth: true,
    primaryAccountId: "mock-bangkok-bank",
    currency: CURRENCY,
    calculatedBalanceMinor: available.amountMinor,
    verificationLabel: "Verifierat i morse · Bangkok Bank",
    checkpointVerifiedAt: new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      8,
      12,
    ).toISOString(),
    todaySpendingMinor: spentToday.amountMinor,
    safeToSpendTodayMinor: afterSpend.today.amountMinor,
    safeToSpendWeekMinor: afterSpend.week.amountMinor,
    freeMinor: afterSpend.free.amountMinor,
    reservedMinor: reserved.amountMinor,
    bufferMinor: safetyBuffer.amountMinor,
    daysUntilIncome,
    dayPulseStatus: pulse.status,
    dayPulseDeltaMinor: pulse.delta.amountMinor,
    dayPulseUsedPercent: pulse.usedPercent,
    referenceSekApprox: Math.round((available.amountMinor / 100) * 0.3),
    goals: [
      {
        id: "g-flight",
        name: "Flyg hem i juni",
        amountMinor: 12_000_00,
        currency: CURRENCY,
      },
      {
        id: "g-emergency",
        name: "Nödkassa",
        amountMinor: 4_500_00,
        currency: CURRENCY,
      },
    ],
    recent: [
      {
        id: "tx-1",
        description: "7-Eleven Asoke",
        category: "Mat",
        transactionType: "expense",
        direction: "debit",
        amountMinor: 186_00,
        currency: CURRENCY,
      },
      {
        id: "tx-2",
        description: "BTS / Grab",
        category: "Transport",
        transactionType: "expense",
        direction: "debit",
        amountMinor: 85_00,
        currency: CURRENCY,
      },
      {
        id: "tx-3",
        description: "Lunch Sukhumvit",
        category: "Mat",
        transactionType: "expense",
        direction: "debit",
        amountMinor: 149_00,
        currency: CURRENCY,
      },
      {
        id: "tx-4",
        description: "Lön (förra)",
        category: "Inkomst",
        transactionType: "income",
        direction: "credit",
        amountMinor: 42_000_00,
        currency: CURRENCY,
      },
    ],
  };
}

export function homeGreeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 11) return "God morgon";
  if (hour < 18) return "Hej";
  return "God kväll";
}
