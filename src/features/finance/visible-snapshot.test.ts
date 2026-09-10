import { describe, expect, it } from "vitest";
import {
  canPaintAnalysHistory,
  canPaintPlanHistory,
  resolveVisibleAnalysSnapshot,
  resolveVisiblePlanSnapshot,
} from "./visible-snapshot";
import type { AnalysSnapshot } from "./load-analys";
import type { PlanSnapshot } from "./load-plan";

function plan(partial: Partial<PlanSnapshot> & { items: PlanSnapshot["items"] }): PlanSnapshot {
  return {
    currency: "THB",
    timeZone: "Asia/Bangkok",
    bankBalanceMinor: 1,
    spendingByMonthKey: {},
    ledgerTransactions: [],
    financeRevision: "real",
    verifiedAt: "2026-09-08T00:00:00.000Z",
    truthStatus: "verified",
    ...partial,
  };
}

describe("visible Plan / Analys history", () => {
  it("never paints empty Plan rows before the server confirms empty", () => {
    expect(canPaintPlanHistory(null, null, null)).toBe(false);
    expect(canPaintPlanHistory(plan({ items: [] }), null, "timeout")).toBe(false);
    expect(
      canPaintPlanHistory(
        plan({ items: [], financeRevision: "empty:u:0" }),
        null,
        null,
      ),
    ).toBe(false);
  });

  it("paints Plan when last-known or the server has rows", () => {
    const withRows = plan({
      items: [{ id: "hyra" } as PlanSnapshot["items"][number]],
    });
    const resolved = resolveVisiblePlanSnapshot(plan({ items: [] }), withRows);
    expect(canPaintPlanHistory(withRows, null, null)).toBe(true);
    expect(canPaintPlanHistory(resolved, withRows, null)).toBe(true);
    expect(canPaintPlanHistory(plan({ items: [] }), plan({ items: [] }), null)).toBe(
      true,
    );
  });

  it("keeps last-known Plan rows over a later empty placeholder", () => {
    const stored = plan({
      items: [{ id: "hyra" } as PlanSnapshot["items"][number]],
      financeRevision: "real",
    });
    const incoming = plan({
      items: [],
      financeRevision: "empty:u:0",
    });
    expect(resolveVisiblePlanSnapshot(stored, incoming)?.items).toHaveLength(1);
  });

  it("adopts a confirmed empty Plan when the user deleted every row", () => {
    const stored = plan({
      items: [{ id: "hyra" } as PlanSnapshot["items"][number]],
      financeRevision: "real-old",
    });
    const incoming = plan({
      items: [],
      financeRevision: "real-empty",
    });
    expect(resolveVisiblePlanSnapshot(stored, incoming)?.items).toHaveLength(0);
    expect(resolveVisiblePlanSnapshot(stored, incoming)?.financeRevision).toBe(
      "real-empty",
    );
  });

  it("adopts a richer server Plan over a blank persist", () => {
    const stored = plan({ items: [], financeRevision: "empty:u:0" });
    const incoming = plan({
      items: [{ id: "hyra" } as PlanSnapshot["items"][number]],
    });
    expect(resolveVisiblePlanSnapshot(stored, incoming)?.items[0]?.id).toBe("hyra");
  });

  it("waits on Analys instead of painting empty months", () => {
    const empty = {
      planItems: [],
      ledgerTransactions: [],
      financeRevision: "empty:u:0",
    } as AnalysSnapshot;
    expect(canPaintAnalysHistory(empty, null, null)).toBe(false);
    expect(canPaintAnalysHistory(null, null, null)).toBe(false);
    expect(canPaintAnalysHistory(empty, empty, null)).toBe(true);
  });

  it("keeps last-known Analys rows over an empty incoming snapshot", () => {
    const stored = {
      planItems: [{ id: "hyra" }],
      ledgerTransactions: [],
      financeRevision: "real",
    } as unknown as AnalysSnapshot;
    const incoming = {
      planItems: [],
      ledgerTransactions: [],
      financeRevision: "empty:u:0",
    } as unknown as AnalysSnapshot;
    expect(resolveVisibleAnalysSnapshot(stored, incoming)?.planItems).toHaveLength(
      1,
    );
  });

  it("adopts a confirmed empty Analys when the server has no rows", () => {
    const stored = {
      planItems: [{ id: "hyra" }],
      ledgerTransactions: [],
      financeRevision: "real-old",
    } as unknown as AnalysSnapshot;
    const incoming = {
      planItems: [],
      ledgerTransactions: [],
      financeRevision: "real-empty",
    } as unknown as AnalysSnapshot;
    expect(resolveVisibleAnalysSnapshot(stored, incoming)?.planItems).toHaveLength(
      0,
    );
  });
});
