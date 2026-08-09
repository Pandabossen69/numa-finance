import type { CurrencyCode } from "@/domain/money";
import type { PlanCategoryKind, PlanItem } from "./types";

/** Special plan row used only for runway date (amount may be 0). */
export const NEXT_INCOME_NAME = "Nästa inkomst";

export type PlanSpendInput = {
  amountMinor: number;
  description: string;
  category?: string | null;
  currency: CurrencyCode;
  /** Only confirmed expenses should be passed in. */
  transactionType?: string;
  status?: string;
};

export type PlanTotals = {
  /** Still unpaid / unspent against reserved buckets — used by safe-to-spend. */
  reservedMinor: number;
  /** Original reserved plan total before applying period spending. */
  reservedPlannedMinor: number;
  bufferMinor: number;
  /** Remaining flexible pool after matched flexible spend. */
  flexibleMinor: number;
  flexiblePlannedMinor: number;
  daysUntilNextIncome: number;
  /** Per-item remaining after allocation (excludes income marker). */
  itemRemaining: Array<{
    itemId: string;
    plannedMinor: number;
    remainingMinor: number;
    spentMinor: number;
  }>;
};

const RESERVED_KINDS = new Set<PlanCategoryKind>([
  "mandatory",
  "expected",
  "goal",
]);

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("sv-SE");
}

/** Map everyday expense categories to likely plan kinds. */
function kindsForCategory(category: string | null | undefined): PlanCategoryKind[] {
  if (!category) return [];
  switch (normalize(category)) {
    case "boende":
    case "räkning":
    case "rakning":
      return ["mandatory", "expected"];
    case "mat":
    case "café":
    case "cafe":
    case "transport":
    case "hälsa":
    case "halsa":
      return ["expected", "mandatory", "flexible"];
    case "shopping":
    case "nöje":
    case "noje":
      return ["flexible", "expected"];
    default:
      return ["expected", "flexible", "mandatory"];
  }
}

function isExpenseSpend(spend: PlanSpendInput): boolean {
  if (spend.status && spend.status !== "confirmed") return false;
  if (spend.transactionType && spend.transactionType !== "expense") return false;
  return spend.amountMinor > 0;
}

/**
 * Allocate period expenses onto plan buckets so paid obligations no longer
 * inflate "reserved" after the money has already left the account.
 *
 * Match order per spend:
 * 1) Exact name ↔ description or category
 * 2) Kind hints from category (Boende → Måste first, etc.)
 */
export function allocateSpendingToPlan(
  items: PlanItem[],
  spending: PlanSpendInput[],
  currency: CurrencyCode,
): Map<string, number> {
  const remaining = new Map<string, number>();
  const active = items.filter(
    (i) =>
      i.isActive &&
      i.currency === currency &&
      i.name !== NEXT_INCOME_NAME &&
      i.kind !== "buffer",
  );

  for (const item of active) {
    remaining.set(item.id, Math.max(0, item.amountMinor));
  }

  for (const spend of spending) {
    if (!isExpenseSpend(spend)) continue;
    if (spend.currency !== currency) continue;

    let left = spend.amountMinor;
    const desc = normalize(spend.description);
    const cat = spend.category ? normalize(spend.category) : "";

    const exact = active.filter((item) => {
      const name = normalize(item.name);
      return name === desc || (cat !== "" && name === cat);
    });

    left = drain(exact, remaining, left);

    if (left <= 0) continue;

    const kindOrder = kindsForCategory(spend.category);
    for (const kind of kindOrder) {
      if (left <= 0) break;
      const pool = active.filter((item) => {
        if (item.kind !== kind) return false;
        return (remaining.get(item.id) ?? 0) > 0;
      });
      // Prefer items whose name shares a token with description/category.
      pool.sort((a, b) => {
        const score = (item: PlanItem) => {
          const name = normalize(item.name);
          if (cat && name.includes(cat)) return 0;
          if (desc && (name.includes(desc) || desc.includes(name))) return 1;
          return 2;
        };
        return score(a) - score(b);
      });
      left = drain(pool, remaining, left);
    }
    // Leftover spend already reduced available balance — do not force into plan.
  }

  return remaining;
}

function drain(
  items: PlanItem[],
  remaining: Map<string, number>,
  amount: number,
): number {
  let left = amount;
  for (const item of items) {
    if (left <= 0) break;
    const avail = remaining.get(item.id) ?? 0;
    if (avail <= 0) continue;
    const take = Math.min(avail, left);
    remaining.set(item.id, avail - take);
    left -= take;
  }
  return left;
}

/**
 * Sum active plan buckets for safe-to-spend inputs.
 * Buffer is separate and not reduced by spending.
 * Reserved/flexible use *remaining* after period expenses when provided.
 * Runway days come from the soonest future nextDueAt, else defaultDays.
 */
export function calculatePlanTotals(
  items: PlanItem[],
  currency: CurrencyCode,
  now: Date = new Date(),
  defaultDays = 17,
  periodSpending: PlanSpendInput[] = [],
): PlanTotals {
  let reservedPlannedMinor = 0;
  let bufferMinor = 0;
  let flexiblePlannedMinor = 0;
  let soonestDue: number | null = null;

  for (const item of items) {
    if (!item.isActive || item.currency !== currency) continue;

    if (item.nextDueAt) {
      const due = Date.parse(item.nextDueAt);
      if (Number.isFinite(due) && due > now.getTime()) {
        soonestDue = soonestDue == null ? due : Math.min(soonestDue, due);
      }
    }

    if (item.name === NEXT_INCOME_NAME) continue;

    if (RESERVED_KINDS.has(item.kind)) {
      reservedPlannedMinor += Math.max(0, item.amountMinor);
    } else if (item.kind === "buffer") {
      bufferMinor += Math.max(0, item.amountMinor);
    } else if (item.kind === "flexible") {
      flexiblePlannedMinor += Math.max(0, item.amountMinor);
    }
  }

  const remainingMap = allocateSpendingToPlan(items, periodSpending, currency);

  let reservedMinor = 0;
  let flexibleMinor = 0;
  const itemRemaining: PlanTotals["itemRemaining"] = [];

  for (const item of items) {
    if (!item.isActive || item.currency !== currency) continue;
    if (item.name === NEXT_INCOME_NAME) continue;
    if (item.kind === "buffer") continue;

    const planned = Math.max(0, item.amountMinor);
    const remaining = remainingMap.has(item.id)
      ? Math.max(0, remainingMap.get(item.id)!)
      : planned;
    const spent = Math.max(0, planned - remaining);

    itemRemaining.push({
      itemId: item.id,
      plannedMinor: planned,
      remainingMinor: remaining,
      spentMinor: spent,
    });

    if (RESERVED_KINDS.has(item.kind)) {
      reservedMinor += remaining;
    } else if (item.kind === "flexible") {
      flexibleMinor += remaining;
    }
  }

  // No spending provided → remaining equals planned (backward compatible).
  if (periodSpending.length === 0) {
    reservedMinor = reservedPlannedMinor;
    flexibleMinor = flexiblePlannedMinor;
  }

  let daysUntilNextIncome = defaultDays;
  if (soonestDue != null) {
    const ms = soonestDue - now.getTime();
    daysUntilNextIncome = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }

  return {
    reservedMinor,
    reservedPlannedMinor,
    bufferMinor,
    flexibleMinor,
    flexiblePlannedMinor,
    daysUntilNextIncome,
    itemRemaining,
  };
}
