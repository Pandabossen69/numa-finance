import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const coverage = readFileSync(
  new URL("../../domain/finance/cash-coverage.ts", import.meta.url),
  "utf8",
);
const planMonths = readFileSync(
  new URL("../../domain/finance/plan-months.ts", import.meta.url),
  "utf8",
);
const sync = readFileSync(
  new URL("./sync-settle-ledger.ts", import.meta.url),
  "utf8",
);

/**
 * Betald / Mottagen / Delvis is a statement by the user. Nothing else in the
 * app may write or infer it — the ledger matcher exists only so Över does not
 * subtract cash twice.
 */
describe("settle state is written by user action only", () => {
  it("writes settle fields from setPlanItemSettledAction and nowhere else", () => {
    const writers = actions.match(/settledAt(?:,|\s*[:=])/g) ?? [];
    expect(writers.length).toBeGreaterThan(0);
    expect(actions).toContain("if (input.settled)");
    expect(actions).toContain("settlePlanItemAtomic");
    expect(actions).toContain("refreshTodaySnapshot");
    expect(actions).toContain("homeSnapshotFromToday");
    expect(actions).toContain("revalidateSettleCaches");
    expect(actions).toContain('revalidateTag(NUMA_MENU_SNAPSHOT_TAG, "max")');
    // No matcher anywhere near the write path.
    expect(actions).not.toContain("matchPlanItemsToLedger");
    const settleFn = actions.slice(
      actions.indexOf("export async function setPlanItemSettledAction"),
      actions.indexOf("export async function confirmPlanLinkAction"),
    );
    expect(settleFn).toContain("settlePlanItemAtomic");
    expect(settleFn).not.toContain("syncPlanItemSettleLedger");
    expect(settleFn).not.toContain("updatePlanItem(");
    expect(settleFn).toContain("refreshTodaySnapshot");
  });

  it("keeps the matcher out of plan status and sorting", () => {
    expect(planMonths).toContain(
      "export function planListStatus(item: PlanItem): PlanListStatus {",
    );
    // No caller may pass a match into the status, so no second argument.
    expect(planMonths).not.toMatch(/planListStatus\([^)]*,/);
    expect(planMonths).toContain(
      "export function sortPlanRowsForList(items: readonly PlanItem[]): PlanItem[] {",
    );
    // countsTowardCashMinor is the money path and still takes the match.
    expect(planMonths).toContain("ledgerMatched = false");
    expect(planMonths).toContain("if (ledgerMatched) return 0;");
  });

  it("books saldo only through plan-linked rows and never voids a bank tx", () => {
    expect(sync).toContain("listTransactionsByPlanItemId");
    expect(sync).toContain("planItemAlreadyFundedInLedger");
    expect(sync).toContain('source: "manual"');
    expect(sync).toContain("planItemId: input.planItemId");
    expect(sync).toContain("occurredAt: new Date().toISOString()");
    expect(sync).toContain("updateTransaction");
    expect(sync).not.toContain("matchPlanItemsToLedger");
    expect(sync).toContain("Never voids a row without plan_item_id");
  });

  it("documents the matcher as money-only", () => {
    expect(coverage).toContain("never a claim that the user paid");
    expect(coverage).toContain("must not reach the Plan list");
  });
});

describe("settle action API naming", () => {
  it("uses targetSettledAmount — never an ambiguous amount field", () => {
    expect(actions).toContain("targetSettledAmount");
    expect(actions).toMatch(/settleSchema[\s\S]*?targetSettledAmount/);
    // The settle schema must not expose a generic `amount` key.
    const schema = actions.slice(
      actions.indexOf("settleSchema"),
      actions.indexOf("export async function setPlanItemSettledAction"),
    );
    expect(schema).not.toMatch(/\bamount:/);
  });
});
