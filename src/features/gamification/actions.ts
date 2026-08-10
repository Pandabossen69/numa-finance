"use server";

import { revalidatePath } from "next/cache";
import {
  calculateDayPulse,
  describeDayClose,
  isDayOnTrack,
  type DayPulse,
} from "@/domain/gamification";
import { money } from "@/domain/money";
import { getTodaySnapshot, recordOnTrackDayIfNeeded } from "@/lib/store/repository";

export type CloseDayResult =
  | {
      ok: true;
      alreadyClosedToday: boolean;
      status: DayPulse["status"];
      currentStreak: number;
      headlineSv: string;
      bodySv: string;
    }
  | { ok: false; error: string };

/**
 * Closes out "today" and awards the streak from today's pulse
 * (plus/even = on track, minus = not). Safe to call more than once a
 * day — later calls just report the day is already closed.
 */
export async function closeDayAction(): Promise<CloseDayResult> {
  try {
    const snap = await getTodaySnapshot();
    if (!snap.primaryAccount) {
      return {
        ok: false,
        error: "Lägg till ett konto innan du kan avsluta dagen",
      };
    }

    const pulse = calculateDayPulse({
      plannedToday: money(snap.dayPlanMinor, snap.currency),
      spentToday: money(snap.todaySpendingMinor, snap.currency),
    });

    const { progress, alreadyRecordedToday } = await recordOnTrackDayIfNeeded(
      isDayOnTrack(pulse.status),
    );

    const currentStreak =
      progress?.currentStreak ?? snap.progress?.currentStreak ?? 0;

    const feedback = describeDayClose({
      status: pulse.status,
      alreadyClosedToday: alreadyRecordedToday,
      currentStreak,
    });

    revalidatePath("/idag");

    return {
      ok: true,
      alreadyClosedToday: alreadyRecordedToday,
      status: pulse.status,
      currentStreak,
      headlineSv: feedback.headlineSv,
      bodySv: feedback.bodySv,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Kunde inte avsluta dagen",
    };
  }
}
