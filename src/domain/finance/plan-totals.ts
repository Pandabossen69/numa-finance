import type { CurrencyCode } from "@/domain/money";
import type { PlanItem } from "./types";

/** Special plan row used only for runway date (amount may be 0). */
export const NEXT_INCOME_NAME = "Nästa inkomst";

export type PlanTotals = {
  reservedMinor: number;
  bufferMinor: number;
  flexibleMinor: number;
  daysUntilNextIncome: number;
};

const RESERVED_KINDS = new Set(["mandatory", "expected", "goal"]);

/**
 * Sum active plan buckets for safe-to-spend inputs.
 * Buffer is separate. Flexible can cap the daily pool.
 * Runway days come from the soonest future nextDueAt, else defaultDays.
 */
export function calculatePlanTotals(
  items: PlanItem[],
  currency: CurrencyCode,
  now: Date = new Date(),
  defaultDays = 17,
): PlanTotals {
  let reservedMinor = 0;
  let bufferMinor = 0;
  let flexibleMinor = 0;
  let soonestDue: number | null = null;

  for (const item of items) {
    if (!item.isActive || item.currency !== currency) continue;

    if (item.nextDueAt) {
      const due = Date.parse(item.nextDueAt);
      if (Number.isFinite(due) && due > now.getTime()) {
        soonestDue = soonestDue == null ? due : Math.min(soonestDue, due);
      }
    }

    // Runway marker / planned income rows are not expense reservations.
    if (item.name === NEXT_INCOME_NAME) continue;
    if ((item.cadence ?? "").toLowerCase() === "income") continue;

    if (RESERVED_KINDS.has(item.kind)) {
      reservedMinor += Math.max(0, item.amountMinor);
    } else if (item.kind === "buffer") {
      bufferMinor += Math.max(0, item.amountMinor);
    } else if (item.kind === "flexible") {
      flexibleMinor += Math.max(0, item.amountMinor);
    }
  }

  let daysUntilNextIncome = defaultDays;
  if (soonestDue != null) {
    const ms = soonestDue - now.getTime();
    daysUntilNextIncome = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }

  return {
    reservedMinor,
    bufferMinor,
    flexibleMinor,
    daysUntilNextIncome,
  };
}
