import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import type { CanonicalTransaction, PlanItem } from "@/domain/finance";
import {
  ensurePlanMonthPaint,
  planMonthPaintStamp,
  prefetchAdjacentPlanMonths,
  readPlanMonthPaint,
  resetPlanMonthCacheForTests,
  softSwitchPlanMonth,
} from "./plan-month-cache";
import {
  PLAN_MONTH_VISIBLE_BUDGET_MS,
  buildPlanMonthPaint,
} from "./plan-month-paint";

const TZ = "Asia/Bangkok";

function item(
  partial: Partial<PlanItem> & Pick<PlanItem, "kind" | "amountMinor" | "name">,
): PlanItem {
  return {
    id: partial.id ?? crypto.randomUUID(),
    userId: "u1",
    name: partial.name,
    kind: partial.kind,
    amountMinor: partial.amountMinor,
    currency: "THB",
    cadence: partial.cadence ?? "monthly",
    nextDueAt: partial.nextDueAt ?? "2026-09-01T12:00:00.000Z",
    isActive: partial.isActive ?? true,
    settledAt: partial.settledAt ?? null,
    settledMinor: partial.settledMinor ?? null,
    remainingDueAt: partial.remainingDueAt ?? null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function tx(
  partial: Pick<CanonicalTransaction, "id" | "amountMinor" | "occurredAt"> &
    Partial<CanonicalTransaction>,
): CanonicalTransaction {
  const occurredAt = partial.occurredAt;
  return {
    id: partial.id,
    userId: "u1",
    accountId: "a1",
    counterAccountId: null,
    currency: "THB",
    description: partial.description ?? "köp",
    merchant: partial.merchant ?? null,
    category: null,
    status: partial.status ?? "confirmed",
    balanceAfterMinor: partial.balanceAfterMinor ?? null,
    fingerprint: partial.fingerprint ?? null,
    sourceObservationId: partial.sourceObservationId ?? null,
    syncStatus: "saved",
    createdAt: occurredAt,
    updatedAt: occurredAt,
    transferGroupId: null,
    planItemId: partial.planItemId ?? null,
    ledgerOrigin: partial.ledgerOrigin,
    linkedPlanItemId: partial.linkedPlanItemId ?? null,
    amountMinor: partial.amountMinor,
    occurredAt,
    direction: partial.direction ?? "debit",
    transactionType: partial.transactionType ?? "expense",
    source: partial.source ?? "manual",
  };
}

function hugoLikeInput(monthKey: string) {
  const items: PlanItem[] = [
    item({
      id: "lön",
      name: "Trukks",
      kind: "expected",
      cadence: "income",
      amountMinor: 51_000_00,
      nextDueAt: `${monthKey}-25T12:00:00.000Z`,
    }),
    item({
      id: "hyra",
      name: "Hyra",
      kind: "mandatory",
      amountMinor: 15_000_00,
      nextDueAt: `${monthKey}-01T12:00:00.000Z`,
    }),
    item({
      id: "save-sep",
      name: "Spara denna månad",
      kind: "goal",
      cadence: "savings",
      amountMinor: 15_000_00,
      nextDueAt: "2026-09-15T12:00:00.000Z",
    }),
    item({
      id: "save-okt",
      name: "Spara denna månad",
      kind: "goal",
      cadence: "savings",
      amountMinor: 15_000_00,
      nextDueAt: "2026-10-15T12:00:00.000Z",
      updatedAt: "2026-09-18T00:00:00.000Z",
    }),
  ];
  for (let i = 0; i < 40; i++) {
    const dueMonth = i % 2 === 0 ? "2026-09" : "2026-10";
    items.push(
      item({
        id: `bill-${i}`,
        name: `Räkning ${i}`,
        kind: "mandatory",
        amountMinor: 500_00 + i * 10,
        nextDueAt: `${dueMonth}-${String((i % 27) + 1).padStart(2, "0")}T12:00:00.000Z`,
      }),
    );
  }
  const ledger: CanonicalTransaction[] = [];
  for (let i = 0; i < 180; i++) {
    const month = i % 2 === 0 ? "2026-09" : "2026-10";
    ledger.push(
      tx({
        id: `tx-${i}`,
        amountMinor: 220_00 + i,
        occurredAt: `${month}-${String((i % 27) + 1).padStart(2, "0")}T10:00:00.000Z`,
      }),
    );
  }
  return {
    items,
    ledgerTransactions: ledger,
    monthKey,
    timeZone: TZ,
    saldoMinor: 18_650_75,
  };
}

afterEach(() => {
  resetPlanMonthCacheForTests();
});

describe("plan month paint cache", () => {
  it("keeps Spec O spar split: sep avsätt vs okt prior sparat", () => {
    const sep = buildPlanMonthPaint(hugoLikeInput("2026-09"));
    const okt = buildPlanMonthPaint(hugoLikeInput("2026-10"));
    expect(sep.coverage.savingsThisMonthMinor).toBe(15_000_00);
    expect(sep.coverage.monthKey).toBe("2026-09");
    expect(okt.coverage.savingsPriorMinor).toBe(15_000_00);
    expect(okt.coverage.savingsThisMonthMinor).toBe(15_000_00);
    expect(sep.projection.incomes[0]?.name).toBe("Trukks");
    expect(okt.projection.fixedItems.some((row) => row.name === "Hyra")).toBe(
      true,
    );
  });

  it("returns the same object on a stamp hit and rebuilds when saldo changes", () => {
    const input = hugoLikeInput("2026-09");
    const first = ensurePlanMonthPaint(input);
    const stamp = planMonthPaintStamp(input);
    expect(readPlanMonthPaint("2026-09", stamp)).toBe(first);
    expect(ensurePlanMonthPaint(input, stamp)).toBe(first);

    const next = ensurePlanMonthPaint({ ...input, saldoMinor: 20_000_00 });
    expect(next).not.toBe(first);
    expect(next.coverage.saldoMinor).toBe(20_000_00);
  });

  it("prefetches ±1 month so sep↔okt is a cache hit under 300ms", () => {
    const sepInput = hugoLikeInput("2026-09");
    const stamp = planMonthPaintStamp(sepInput);
    ensurePlanMonthPaint(sepInput, stamp);
    const warmed = prefetchAdjacentPlanMonths(sepInput, stamp);
    expect(warmed).toEqual(["2026-08", "2026-10"]);

    const switchToOkt = softSwitchPlanMonth(
      { ...sepInput, monthKey: "2026-10" },
      stamp,
    );
    expect(switchToOkt.fromCache).toBe(true);
    expect(switchToOkt.elapsedMs).toBeLessThan(PLAN_MONTH_VISIBLE_BUDGET_MS);
    expect(switchToOkt.paint.coverage.monthKey).toBe("2026-10");
    expect(switchToOkt.paint.coverage.overMinor).toBeTypeOf("number");
    expect(switchToOkt.paint.projection.items.length).toBeGreaterThan(0);

    const backToSep = softSwitchPlanMonth(sepInput, stamp);
    expect(backToSep.fromCache).toBe(true);
    expect(backToSep.elapsedMs).toBeLessThan(PLAN_MONTH_VISIBLE_BUDGET_MS);
    expect(backToSep.paint.coverage.monthKey).toBe("2026-09");
  });

  it("keeps the soft-switch path free of the link matcher and server actions", () => {
    const src = readFileSync(new URL("./plan-month-cache.ts", import.meta.url), "utf8");
    const soft = src.slice(
      src.indexOf("export function softSwitchPlanMonth"),
      src.indexOf("export function schedulePrefetchAdjacentPlanMonths"),
    );
    expect(soft).toContain("ensurePlanMonthPaint");
    expect(soft).not.toContain("ensurePlanMonthSuggestions");
    expect(soft).not.toContain("buildPlanMonthSuggestions");
    expect(src).not.toContain("getPlanPageDataAction");
    expect(src).not.toContain("router.refresh");
  });

  it("builds a cold month without a network hop and stays under the visible budget", () => {
    const cold = softSwitchPlanMonth(hugoLikeInput("2026-10"));
    expect(cold.fromCache).toBe(false);
    expect(cold.elapsedMs).toBeLessThan(PLAN_MONTH_VISIBLE_BUDGET_MS);
    expect(cold.paint.coverage.monthKey).toBe("2026-10");
    expect(cold.paint.linkedPlanIds).toBeInstanceOf(Set);
    expect(cold.paint).not.toHaveProperty("linkSuggestions");
  });
});
