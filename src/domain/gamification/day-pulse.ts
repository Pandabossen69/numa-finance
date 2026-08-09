import type { Money } from "@/domain/money";
import { money, clampNonNegative } from "@/domain/money";

/**
 * Live day status — derived only from canonical finance inputs.
 * Gamification may *display* this; it must never invent a second budget.
 *
 * `plannedToday` is the morning day-plan (safe-to-spend before today's
 * activity). Do not pass the live post-spend STS — that double-counts spend.
 */
export type DayPulseInput = {
  /** Morning day-plan (not live post-spend safe-to-spend). */
  plannedToday: Money;
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
  if (input.plannedToday.currency !== input.spentToday.currency) {
    throw new Error("Day pulse currency mismatch");
  }

  const currency = input.plannedToday.currency;
  const planned = Math.max(0, input.plannedToday.amountMinor);
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

/**
 * Whether a day counts as "on track" for streak purposes.
 * Plus and even both count — only minus breaks the streak.
 */
export function isDayOnTrack(status: DayPulse["status"]): boolean {
  return status !== "minus";
}

export type DayCloseFeedback = {
  headlineSv: string;
  bodySv: string;
};

/**
 * Calm, Swedish end-of-day copy for the close-day action.
 * Pure so the UI/server action can stay thin and testable.
 */
export function describeDayClose(input: {
  status: DayPulse["status"];
  alreadyClosedToday: boolean;
  currentStreak: number;
}): DayCloseFeedback {
  const days = input.currentStreak === 1 ? "dag" : "dagar";

  if (input.alreadyClosedToday) {
    return {
      headlineSv: "Redan avslutad",
      bodySv:
        input.currentStreak > 0
          ? `Du har redan sparat dagens läge. Streak: ${input.currentStreak} ${days}.`
          : "Du har redan sparat dagens läge. Imorgon är nästa chans.",
    };
  }

  if (input.status === "minus") {
    return {
      headlineSv: "Dagens läge sparat",
      bodySv:
        "Det blev minus idag, men det är ingen katastrof — imorgon är en ny dag.",
    };
  }

  return {
    headlineSv: "Dagens läge sparat",
    bodySv:
      input.currentStreak > 0
        ? `Snyggt — du höll planen idag. Streak: ${input.currentStreak} ${days}.`
        : "Snyggt — du höll planen idag.",
  };
}

export type StreakHint = {
  /** Conceptual streak counter — Phase later persists this. */
  onTrackDays: number;
};

/**
 * Personal ranks unlock from on-track days (self competition).
 * Global "place in the world" later ranks by discipline_score among
 * users who opted into leaderboard_visible — never by bank balance.
 */
export const RANK_LADDER = [
  { id: "start", titleSv: "Start", minOnTrackDays: 0, minLevel: 1 },
  { id: "stadig", titleSv: "Stadig", minOnTrackDays: 3, minLevel: 2 },
  { id: "disciplinerad", titleSv: "Disciplinerad", minOnTrackDays: 7, minLevel: 3 },
  { id: "trygg", titleSv: "Trygg", minOnTrackDays: 14, minLevel: 4 },
  { id: "mästare", titleSv: "Mästare", minOnTrackDays: 30, minLevel: 5 },
] as const;

export type Rank = (typeof RANK_LADDER)[number];
export type RankId = Rank["id"];

/** Public-safe leaderboard row shape (no money fields). */
export type LeaderboardEntry = {
  place: number;
  displayName: string;
  level: number;
  rankId: RankId;
  disciplineScore: number;
  currentStreak: number;
};

export function rankForOnTrackDays(onTrackDays: number): Rank {
  let current: Rank = RANK_LADDER[0]!;
  for (const rank of RANK_LADDER) {
    if (onTrackDays >= rank.minOnTrackDays) current = rank;
  }
  return current;
}
