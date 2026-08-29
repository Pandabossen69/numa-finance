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
    expect(actions).toContain("let settledAt: string | null = null");
    expect(actions).toContain("let settledMinor: number | null = null");
    // No matcher anywhere near the write path.
    expect(actions).not.toContain("matchPlanItemsToLedger");
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

  it("documents the matcher as money-only", () => {
    expect(coverage).toContain("never a claim that the user paid");
    expect(coverage).toContain("must not reach the Plan list");
  });
});
