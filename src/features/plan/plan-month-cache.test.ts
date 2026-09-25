import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { planRowView, type CanonicalTransaction, type PlanItem } from "@/domain/finance";
import {
  ensurePlanMonthPaint,
  lastPlanMonthPaint,
  planMonthPaintEpoch,
  planMonthPaintStamp,
  prefetchAdjacentPlanMonths,
  readPlanMonthPaint,
  resetPlanMonthCacheForTests,
  resolvePlanMonthPaint,
  softSwitchPlanMonth,
} from "./plan-month-cache";
import {
  PLAN_MONTH_BLANK_BUDGET_MS,
  PLAN_MONTH_VISIBLE_BUDGET_MS,
  buildPlanMonthChrome,
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
    expect(switchToOkt.ready).toBe(true);
    expect(switchToOkt.elapsedMs).toBeLessThan(PLAN_MONTH_VISIBLE_BUDGET_MS);
    expect(switchToOkt.paint.coverage.monthKey).toBe("2026-10");
    expect(switchToOkt.paint.coverage.overMinor).toBeTypeOf("number");
    expect(switchToOkt.paint.projection.items.length).toBeGreaterThan(0);

    const backToSep = softSwitchPlanMonth(sepInput, stamp);
    expect(backToSep.fromCache).toBe(true);
    expect(backToSep.elapsedMs).toBeLessThan(PLAN_MONTH_VISIBLE_BUDGET_MS);
    expect(backToSep.paint.coverage.monthKey).toBe("2026-09");
  });

  it("keeps the soft-switch path free of dest project, the link matcher, and server actions", () => {
    const src = readFileSync(new URL("./plan-month-cache.ts", import.meta.url), "utf8");
    const soft = src.slice(
      src.indexOf("export function softSwitchPlanMonth"),
      src.indexOf("export function scheduleEnsurePlanMonthSuggestions"),
    );
    expect(soft).toContain("allowBuild: false");
    expect(soft).toContain("scheduleEnsurePlanMonthPaint");
    expect(soft).not.toContain("buildPlanMonthPaint");
    expect(soft).not.toContain("ensurePlanMonthSuggestions");
    expect(soft).not.toContain("buildPlanMonthSuggestions");
    expect(src).not.toContain("getPlanPageDataAction");
    expect(src).not.toContain("router.refresh");
  });

  it("paints cold pil chrome from a header stub, never another month", () => {
    const sepInput = hugoLikeInput("2026-09");
    const stamp = planMonthPaintStamp(sepInput);
    const sep = ensurePlanMonthPaint(sepInput, stamp);
    expect(lastPlanMonthPaint()).toBe(sep);

    const cold = softSwitchPlanMonth(
      { ...sepInput, monthKey: "2026-10" },
      stamp,
    );
    expect(cold.fromCache).toBe(false);
    expect(cold.ready).toBe(false);
    expect(cold.paint.monthKey).toBe("2026-10");
    expect(cold.paint.coverage.monthKey).toBe("2026-10");
    expect(cold.paint.projection.items).toEqual([]);
    expect(cold.paint).not.toBe(sep);
    expect(cold.elapsedMs).toBeLessThan(PLAN_MONTH_VISIBLE_BUDGET_MS);

    const dest = readPlanMonthPaint("2026-10", stamp);
    expect(dest).not.toBeNull();
    expect(dest?.coverage.monthKey).toBe("2026-10");
    expect(dest?.coverage.savingsThisMonthMinor).toBe(15_000_00);
    expect(dest?.linkedPlanIds).toBeInstanceOf(Set);
    expect(dest).not.toHaveProperty("linkSuggestions");
  });

  it("chrome helper never scans the ledger or projects dest coverage", () => {
    const src = readFileSync(new URL("./plan-month-paint.ts", import.meta.url), "utf8");
    const chrome = src.slice(
      src.indexOf("export function buildPlanMonthChrome"),
      src.indexOf("export function buildPlanMonthPaint"),
    );
    expect(chrome).toContain("labelMonthSv");
    expect(chrome).not.toContain("projectCashCoverage");
    expect(chrome).not.toContain("projectPlanForMonth");
    expect(chrome).not.toContain("importableFixedExpenses");
    expect(chrome).not.toContain("explicitlyLinkedPlanItemIds");
  });

  it("chrome stub skips dest project and dest datapaint stays under the blank budget", () => {
    const chrome = buildPlanMonthChrome("2026-10", 18_650_75);
    expect(chrome.monthKey).toBe("2026-10");
    expect(chrome.projection.items).toEqual([]);
    expect(chrome.coverage.incomingMinor).toBe(0);

    const started =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const dest = ensurePlanMonthPaint(hugoLikeInput("2026-10"));
    const destMs =
      (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      started;
    expect(dest.coverage.monthKey).toBe("2026-10");
    expect(destMs).toBeLessThan(PLAN_MONTH_BLANK_BUDGET_MS);
  });

  it("resolves a same-month stamp miss by building, not last-known of another month", () => {
    const sep = hugoLikeInput("2026-09");
    ensurePlanMonthPaint(sep);
    const resolved = resolvePlanMonthPaint({ ...sep, saldoMinor: 20_000_00 });
    expect(resolved.ready).toBe(true);
    expect(resolved.paint.coverage.saldoMinor).toBe(20_000_00);
    expect(resolved.paint.coverage.monthKey).toBe("2026-09");
  });

  it("changes the paint stamp when settledAt or settledMinor changes", () => {
    const sep = hugoLikeInput("2026-09");
    const before = planMonthPaintStamp(sep);
    const withSettledAt = sep.items.map((row) =>
      row.id === "hyra"
        ? { ...row, settledAt: "2026-09-25T08:08:33.952Z" }
        : row,
    );
    const withSettledMinor = sep.items.map((row) =>
      row.id === "hyra" ? { ...row, settledMinor: 1_000_00 } : row,
    );
    expect(planMonthPaintStamp({ ...sep, items: withSettledAt })).not.toBe(before);
    expect(planMonthPaintStamp({ ...sep, items: withSettledMinor })).not.toBe(
      before,
    );
  });

  it("shows September including a new row after October was prefetched", () => {
    const sep = hugoLikeInput("2026-09");
    const stamp = planMonthPaintStamp(sep);
    ensurePlanMonthPaint(sep, stamp);
    prefetchAdjacentPlanMonths(sep, stamp);
    expect(lastPlanMonthPaint()?.monthKey).toBe("2026-10");

    const added = item({
      id: "qa-race-2",
      name: "QA-race-2",
      kind: "flexible",
      cadence: "once",
      amountMinor: 99_00,
      nextDueAt: "2026-09-15T12:00:00.000Z",
    });
    const next = { ...sep, items: [...sep.items, added] };
    const nextStamp = planMonthPaintStamp(next);
    const shown = resolvePlanMonthPaint(next, nextStamp, { allowBuild: false });
    expect(shown.paint.monthKey).toBe("2026-09");
    expect(shown.paint.coverage.monthKey).toBe("2026-09");

    const ready = resolvePlanMonthPaint(next, nextStamp, { allowBuild: false });
    expect(ready.ready).toBe(true);
    expect(ready.paint.monthKey).toBe("2026-09");
    expect(
      ready.paint.projection.extraItems.some((row) => row.id === "qa-race-2"),
    ).toBe(true);
    expect(
      ready.paint.projection.extraItems.some((row) => row.amountMinor === 99_00),
    ).toBe(true);
  });

  it("keeps the settled badge after settle and revalidate", () => {
    const sep = hugoLikeInput("2026-09");
    const unpaid = ensurePlanMonthPaint(sep);
    const unpaidRow = unpaid.projection.fixedItems.find((row) => row.id === "hyra");
    expect(unpaidRow).toBeTruthy();
    expect(planRowView(unpaidRow!).settled).toBe(false);

    const settledItems = sep.items.map((row) =>
      row.id === "hyra"
        ? {
            ...row,
            settledAt: "2026-09-25T08:08:33.952Z",
            settledMinor: row.amountMinor,
          }
        : row,
    );
    const settled = { ...sep, items: settledItems };
    const settledStamp = planMonthPaintStamp(settled);
    expect(settledStamp).not.toBe(planMonthPaintStamp(sep));

    const pending = resolvePlanMonthPaint(settled, settledStamp, {
      allowBuild: false,
    });
    expect(pending.paint.monthKey).toBe("2026-09");

    const painted = resolvePlanMonthPaint(settled, settledStamp, {
      allowBuild: false,
    });
    expect(painted.ready).toBe(true);
    expect(painted.paint.monthKey).toBe("2026-09");
    const row = painted.paint.projection.fixedItems.find((item) => item.id === "hyra");
    expect(row?.settledMinor).toBe(15_000_00);
    expect(planRowView(row!).settled).toBe(true);
    expect(painted.paint.coverage.unpaidMinor).toBeLessThan(
      unpaid.coverage.unpaidMinor,
    );

    const again = resolvePlanMonthPaint(settled, settledStamp, {
      allowBuild: false,
    });
    expect(again.ready).toBe(true);
    expect(again.paint).toBe(painted.paint);
    expect(
      planRowView(
        again.paint.projection.fixedItems.find((item) => item.id === "hyra")!,
      ).settled,
    ).toBe(true);
  });

  it("schedules a build on stamp miss and never shows another month", () => {
    const sep = hugoLikeInput("2026-09");
    const sepStamp = planMonthPaintStamp(sep);
    ensurePlanMonthPaint(sep, sepStamp);
    prefetchAdjacentPlanMonths(sep, sepStamp);
    expect(lastPlanMonthPaint()?.monthKey).toBe("2026-10");

    const missedInput = { ...sep, saldoMinor: (sep.saldoMinor ?? 0) + 1 };
    const missedStamp = planMonthPaintStamp(missedInput);
    const epoch = planMonthPaintEpoch();
    const shown = resolvePlanMonthPaint(missedInput, missedStamp, {
      allowBuild: false,
    });
    expect(shown.ready).toBe(false);
    expect(shown.paint.monthKey).toBe("2026-09");
    expect(shown.paint.coverage.monthKey).toBe("2026-09");
    expect(shown.paint.monthKey).not.toBe("2026-10");
    expect(planMonthPaintEpoch()).toBeGreaterThan(epoch);
    const built = readPlanMonthPaint("2026-09", missedStamp);
    expect(built?.coverage.monthKey).toBe("2026-09");
    expect(built?.coverage.saldoMinor).toBe(missedInput.saldoMinor);

    const coldEpoch = planMonthPaintEpoch();
    const cold = resolvePlanMonthPaint(
      { ...sep, monthKey: "2026-11" },
      sepStamp,
      { allowBuild: false },
    );
    expect(cold.ready).toBe(false);
    expect(cold.paint.monthKey).toBe("2026-11");
    expect(cold.paint.coverage.monthKey).toBe("2026-11");
    expect(cold.paint.projection.items).toEqual([]);
    expect(planMonthPaintEpoch()).toBeGreaterThan(coldEpoch);
    expect(readPlanMonthPaint("2026-11", sepStamp)?.monthKey).toBe("2026-11");
  });
});
