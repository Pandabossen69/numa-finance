import { describe, expect, it } from "vitest";
import {
  MONTHLY_SAVE_NAME,
  matchPlanItemsToLedger,
  planListStatus,
  projectPlanForMonth,
  type PlanItem,
} from "@/domain/finance";
import {
  applyMonthSavings,
  isTempPlanId,
  adoptServerPlanItems,
  mergeReturnedItem,
  mergeReturnedItems,
  optimisticPlanItem,
  removeItemById,
  revertMonthSavings,
  settlePlanItem,
  stampPlanItems,
} from "./optimistic";

function item(
  partial: Partial<PlanItem> & Pick<PlanItem, "kind" | "amountMinor">,
): PlanItem {
  return {
    id: partial.id ?? crypto.randomUUID(),
    userId: "u1",
    name: partial.name ?? "x",
    kind: partial.kind,
    amountMinor: partial.amountMinor,
    currency: "THB",
    cadence: partial.cadence ?? "monthly",
    nextDueAt: partial.nextDueAt ?? "2026-08-01T12:00:00.000Z",
    isActive: partial.isActive ?? true,
    createdAt: partial.createdAt ?? "2026-08-01T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-08-01T00:00:00.000Z",
  };
}

describe("plan optimistic helpers", () => {
  it("marks temp ids so edit/delete can wait for the real row", () => {
    const created = optimisticPlanItem({
      name: "Hyra",
      kind: "mandatory",
      amountMinor: 15000_00,
      currency: "THB",
      cadence: "monthly",
      nextDueAt: "2026-08-01T12:00:00.000Z",
    });
    expect(isTempPlanId(created.id)).toBe(true);
    expect(isTempPlanId(crypto.randomUUID())).toBe(false);
  });

  it("shows a new fixed expense in the month projection immediately", () => {
    const existing = item({
      name: "El",
      kind: "mandatory",
      amountMinor: 800_00,
    });
    const added = optimisticPlanItem({
      name: "Hyra",
      kind: "mandatory",
      amountMinor: 15000_00,
      currency: "THB",
      cadence: "monthly",
      nextDueAt: "2026-08-01T12:00:00.000Z",
    });
    const projection = projectPlanForMonth(
      [existing, added],
      "2026-08",
      "Asia/Bangkok",
    );
    expect(projection.fixedMinor).toBe(15800_00);
    expect(projection.fixedItems.map((row) => row.name)).toEqual(["El", "Hyra"]);
  });

  it("replaces the temp row with the server row without duplicating", () => {
    const temp = optimisticPlanItem({
      name: "Hyra",
      kind: "mandatory",
      amountMinor: 15000_00,
      currency: "THB",
      cadence: "monthly",
      nextDueAt: "2026-08-01T12:00:00.000Z",
    });
    const saved = item({
      id: "11111111-1111-1111-1111-111111111111",
      name: "Hyra",
      kind: "mandatory",
      amountMinor: 15000_00,
    });
    const merged = mergeReturnedItem([temp], saved, temp.id);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe(saved.id);
    expect(isTempPlanId(merged[0]!.id)).toBe(false);
  });

  it("drops import temps and keeps the persisted copies", () => {
    const keep = item({
      name: "Netflix",
      kind: "mandatory",
      amountMinor: 199_00,
      nextDueAt: "2026-08-05T12:00:00.000Z",
    });
    const temp = optimisticPlanItem({
      name: "Hyra",
      kind: "mandatory",
      amountMinor: 15000_00,
      currency: "THB",
      cadence: "monthly",
      nextDueAt: "2026-09-01T12:00:00.000Z",
    });
    const saved = item({
      id: "22222222-2222-2222-2222-222222222222",
      name: "Hyra",
      kind: "mandatory",
      amountMinor: 15000_00,
      nextDueAt: "2026-09-01T12:00:00.000Z",
    });
    const merged = mergeReturnedItems(
      [keep, temp],
      [saved],
      new Set([temp.id]),
    );
    expect(merged.map((row) => row.id).sort()).toEqual(
      [keep.id, saved.id].sort(),
    );
  });

  it("upserts and reverts month savings without losing other rows", () => {
    const rent = item({
      name: "Hyra",
      kind: "mandatory",
      amountMinor: 10000_00,
    });
    const applied = applyMonthSavings(
      [rent],
      "2026-08",
      2500_00,
      "THB",
      "Asia/Bangkok",
    );
    expect(applied.tempId).toBeTruthy();
    expect(projectPlanForMonth(applied.items, "2026-08", "Asia/Bangkok").savingsMinor).toBe(
      2500_00,
    );

    const reverted = revertMonthSavings(
      applied.items,
      "2026-08",
      applied.previous,
      applied.tempId,
      "Asia/Bangkok",
    );
    expect(reverted).toEqual([rent]);

    const existing = item({
      name: MONTHLY_SAVE_NAME,
      kind: "goal",
      amountMinor: 1000_00,
      cadence: "savings",
      nextDueAt: "2026-08-15T12:00:00.000Z",
    });
    const updated = applyMonthSavings(
      [rent, existing],
      "2026-08",
      0,
      "THB",
      "Asia/Bangkok",
    );
    expect(updated.items).toEqual([rent]);
    expect(
      revertMonthSavings(
        updated.items,
        "2026-08",
        updated.previous,
        updated.tempId,
        "Asia/Bangkok",
      ),
    ).toEqual([rent, existing]);
  });

  it("keeps a just-saved row when the server snapshot is still the old list", () => {
    const existing = item({
      id: "keep",
      kind: "mandatory",
      amountMinor: 800_00,
    });
    const saved = item({
      id: "new",
      kind: "mandatory",
      amountMinor: 15000_00,
      name: "Hyra",
    });
    const adopted = adoptServerPlanItems([existing, saved], [existing]);
    expect(adopted.map((row) => row.id)).toEqual(["keep", "new"]);
  });

  it("keeps local rows when refresh briefly sends an empty list", () => {
    const existing = item({ kind: "mandatory", amountMinor: 800_00 });
    expect(adoptServerPlanItems([existing], [])).toEqual([existing]);
  });

  it("keeps an in-flight temp row on top of a fresh server list", () => {
    const existing = item({
      id: "keep",
      kind: "mandatory",
      amountMinor: 800_00,
    });
    const temp = optimisticPlanItem({
      name: "Hyra",
      kind: "mandatory",
      amountMinor: 15000_00,
      currency: "THB",
      cadence: "monthly",
      nextDueAt: "2026-08-01T12:00:00.000Z",
    });
    const adopted = adoptServerPlanItems([existing, temp], [existing]);
    expect(adopted.map((row) => row.id)).toEqual(["keep", temp.id]);
  });

  it("stamps items so an unchanged server list does not reset local edits", () => {
    const a = item({ kind: "mandatory", amountMinor: 1 });
    const b = item({ kind: "mandatory", amountMinor: 2 });
    expect(stampPlanItems([a, b])).toBe(stampPlanItems([b, a]));
    expect(stampPlanItems([a])).not.toBe(stampPlanItems([b]));
  });

  it("removeItemById leaves the remaining rows intact", () => {
    const a = item({ id: "a", kind: "mandatory", amountMinor: 1 });
    const b = item({ id: "b", kind: "mandatory", amountMinor: 2 });
    expect(removeItemById([a, b], "a")).toEqual([b]);
  });
});

describe("settle flags come from the user's tap only", () => {
  const loan = item({
    id: "pappa",
    name: "Pappa",
    kind: "mandatory",
    amountMinor: 15000_00,
  });

  it("starts open, with nothing written by the app", () => {
    expect(loan.settledAt ?? null).toBeNull();
    expect(loan.settledMinor ?? null).toBeNull();
    expect(planListStatus(loan)).toBe("open");
    // A ledger transaction that would match this row changes the money view,
    // not the row: the matcher output never reaches planListStatus.
    expect(
      matchPlanItemsToLedger({
        items: [loan],
        transactions: [
          {
            id: "tx-1",
            occurredAt: "2026-08-01T09:00:00.000Z",
            amountMinor: 15000_00,
            direction: "debit",
            transactionType: "expense",
            status: "confirmed",
            description: "Pappa",
            merchant: null,
            source: "manual",
            fingerprint: "fp-1",
            balanceAfterMinor: null,
            sourceObservationId: null,
          },
        ],
        kind: "expense",
        monthKey: "2026-08",
        timeZone: "Asia/Bangkok",
      }).has(loan.id),
    ).toBe(true);
    expect(planListStatus(loan)).toBe("open");
  });

  it("marks Betald only when settle is requested", () => {
    const [tapped] = settlePlanItem([loan], loan.id, { settled: true });
    expect(planListStatus(tapped!)).toBe("settled");
    expect(tapped!.settledMinor).toBe(15000_00);
  });

  it("keeps Delvis when a part amount is requested", () => {
    const [partly] = settlePlanItem([loan], loan.id, {
      settled: true,
      settledMinor: 5000_00,
      remainingDueAt: "2026-08-20T12:00:00.000Z",
    });
    expect(planListStatus(partly!)).toBe("partial");
    expect(partly!.settledMinor).toBe(5000_00);
  });

  it("un-settle clears the explicit flags and nothing else", () => {
    const [tapped] = settlePlanItem([loan], loan.id, { settled: true });
    const [undone] = settlePlanItem([tapped!], loan.id, { settled: false });
    expect(undone!.settledAt).toBeNull();
    expect(undone!.settledMinor).toBeNull();
    expect(undone!.remainingDueAt).toBeNull();
    expect(planListStatus(undone!)).toBe("open");
    expect(undone!.name).toBe("Pappa");
    expect(undone!.amountMinor).toBe(15000_00);
  });
});
