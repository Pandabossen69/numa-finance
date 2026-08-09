import type { Money } from "@/domain/money";
import { money, clampNonNegative } from "@/domain/money";

/**
 * Live day status — derived only from canonical finance inputs.
 * Gamification may *display* this; it must never invent a second budget.
 */
export type DayPulseInput = {
  safeToSpendToday: Money;
  spentToday: Money;
};

export type DayPulse = {
  currency: Money["currency"];
  plannedToday: Money;
  spentToday: Money;
  /** Positive = under plan (plus). Negative = over plan (minus). */
  delta: Money;
  status: "plus" | "even" | "minus";
  /** 0–100+ progress of spend vs plan (can exceed 100 when over). */
  usedPercent: number;
  remainingOfPlan: Money;
};

export function calculateDayPulse(input: DayPulseInput): DayPulse {
  if (input.safeToSpendToday.currency !== input.spentToday.currency) {
    throw new Error("Day pulse currency mismatch");
  }

  const currency = input.safeToSpendToday.currency;
  const planned = Math.max(0, input.safeToSpendToday.amountMinor);
  const spent = Math.max(0, input.spentToday.amountMinor);
  const deltaMinor = planned - spent;

  let status: DayPulse["status"] = "even";
  if (deltaMinor > 0) status = "plus";
  if (deltaMinor < 0) status = "minus";

  const usedPercent =
    planned === 0 ? (spent > 0 ? 100 : 0) : Math.round((spent / planned) * 100);

  return {
    currency,
    plannedToday: money(planned, currency),
    spentToday: money(spent, currency),
    delta: money(deltaMinor, currency),
    status,
    usedPercent,
    remainingOfPlan: clampNonNegative(money(deltaMinor, currency)),
  };
}

export type StreakHint = {
  /** Conceptual streak counter — Phase later persists this. */
  onTrackDays: number;
};

/**
 * Rank ladder is display metadata only. Advancement rules must use
 * deterministic finance outcomes (on-plan days, surplus), never vanity metrics alone.
 */
export const RANK_LADDER = [
  { id: "start", titleSv: "Start", minOnTrackDays: 0 },
  { id: "stadig", titleSv: "Stadig", minOnTrackDays: 3 },
  { id: "disciplinerad", titleSv: "Disciplinerad", minOnTrackDays: 7 },
  { id: "trygg", titleSv: "Trygg", minOnTrackDays: 14 },
  { id: "mästare", titleSv: "Mästare", minOnTrackDays: 30 },
] as const;

export type Rank = (typeof RANK_LADDER)[number];
export type RankId = Rank["id"];

export function rankForOnTrackDays(onTrackDays: number): Rank {
  let current: Rank = RANK_LADDER[0]!;
  for (const rank of RANK_LADDER) {
    if (onTrackDays >= rank.minOnTrackDays) current = rank;
  }
  return current;
}
