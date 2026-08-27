import {
  isPlanSavings,
  monthAnchorIso,
  monthKeyFromDate,
  MONTHLY_SAVE_NAME,
  type PlanCategoryKind,
  type PlanItem,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";

export const TEMP_PLAN_PREFIX = "tmp-";

export function newTempPlanId(): string {
  return `${TEMP_PLAN_PREFIX}${crypto.randomUUID()}`;
}

export function isTempPlanId(id: string): boolean {
  return id.startsWith(TEMP_PLAN_PREFIX);
}

export function stampPlanItems(items: PlanItem[]): string {
  return items
    .map(
      (item) =>
        `${item.id}:${item.updatedAt}:${item.amountMinor}:${item.name}:${item.nextDueAt ?? ""}:${item.isActive}:${item.settledAt ?? ""}`,
    )
    .sort()
    .join("|");
}

export function optimisticPlanItem(input: {
  name: string;
  kind: PlanCategoryKind;
  amountMinor: number;
  currency: CurrencyCode;
  cadence: string;
  nextDueAt: string | null;
  userId?: string;
}): PlanItem {
  const ts = new Date().toISOString();
  return {
    id: newTempPlanId(),
    userId: input.userId ?? "",
    name: input.name.trim(),
    kind: input.kind,
    amountMinor: input.amountMinor,
    currency: input.currency,
    cadence: input.cadence,
    nextDueAt: input.nextDueAt,
    isActive: true,
    settledAt: null,
    createdAt: ts,
    updatedAt: ts,
  };
}

export function replaceItemById(
  items: PlanItem[],
  id: string,
  next: PlanItem,
): PlanItem[] {
  return items.map((item) => (item.id === id ? next : item));
}

export function removeItemById(items: PlanItem[], id: string): PlanItem[] {
  return items.filter((item) => item.id !== id);
}

export function mergeReturnedItem(
  items: PlanItem[],
  returned: PlanItem,
  tempId?: string,
): PlanItem[] {
  let replaced = false;
  const next = items.flatMap((item) => {
    if (tempId && item.id === tempId) {
      replaced = true;
      return [returned];
    }
    if (item.id === returned.id) {
      replaced = true;
      return [returned];
    }
    return [item];
  });
  return replaced ? next : [...next, returned];
}

export function mergeReturnedItems(
  items: PlanItem[],
  returned: PlanItem[],
  tempIds: ReadonlySet<string>,
): PlanItem[] {
  const kept = items.filter((item) => !tempIds.has(item.id));
  const have = new Set(kept.map((item) => item.id));
  const extra = returned.filter((item) => !have.has(item.id));
  return [...kept, ...extra];
}

export function findMonthSavings(
  items: PlanItem[],
  monthKey: string,
  timeZone: string,
): PlanItem | undefined {
  return items.find((item) => {
    if (!item.isActive || !isPlanSavings(item) || !item.nextDueAt) return false;
    return monthKeyFromDate(new Date(item.nextDueAt), timeZone) === monthKey;
  });
}

export function applyMonthSavings(
  items: PlanItem[],
  monthKey: string,
  amountMinor: number,
  currency: CurrencyCode,
  timeZone: string,
): { items: PlanItem[]; tempId?: string; previous: PlanItem | null } {
  const existing = findMonthSavings(items, monthKey, timeZone) ?? null;
  if (amountMinor === 0) {
    return {
      items: existing ? removeItemById(items, existing.id) : items,
      previous: existing,
    };
  }
  if (existing) {
    return {
      items: replaceItemById(items, existing.id, {
        ...existing,
        amountMinor,
        updatedAt: new Date().toISOString(),
      }),
      previous: existing,
    };
  }
  const created = optimisticPlanItem({
    name: MONTHLY_SAVE_NAME,
    kind: "goal",
    amountMinor,
    currency,
    cadence: "savings",
    nextDueAt: monthAnchorIso(monthKey),
  });
  return { items: [...items, created], tempId: created.id, previous: null };
}

export function revertMonthSavings(
  items: PlanItem[],
  monthKey: string,
  previous: PlanItem | null,
  tempId: string | undefined,
  timeZone: string,
): PlanItem[] {
  const next = tempId ? removeItemById(items, tempId) : items;
  const current = findMonthSavings(next, monthKey, timeZone);
  if (previous) {
    if (current) {
      return replaceItemById(next, current.id, previous);
    }
    return [...next, previous];
  }
  if (current && !tempId) {
    return removeItemById(next, current.id);
  }
  return next;
}

export function settlePlanItem(
  items: PlanItem[],
  id: string,
  settled: boolean,
): PlanItem[] {
  const ts = new Date().toISOString();
  return items.map((item) =>
    item.id === id ? { ...item, settledAt: settled ? ts : null, updatedAt: ts } : item,
  );
}
