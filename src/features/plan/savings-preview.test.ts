import { describe, expect, it } from "vitest";
import type { PlanItem } from "@/domain/finance";
import { previewMonthSavings } from "./savings-preview";

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
    nextDueAt: partial.nextDueAt ?? "2026-09-15T12:00:00.000Z",
    isActive: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

describe("previewMonthSavings", () => {
  it("shows Över dropping by the draft avsättning before save", () => {
    const items = [
      item({
        name: "Hyra",
        kind: "mandatory",
        amountMinor: 10_000_00,
        nextDueAt: "2026-09-05T12:00:00.000Z",
      }),
    ];
    const preview = previewMonthSavings({
      items,
      monthKey: "2026-09",
      draftMinor: 15_000_00,
      currentMinor: 0,
      currency: "THB",
      timeZone: "Asia/Bangkok",
      ledgerTransactions: [],
      saldoMinor: 50_000_00,
      cycleSpendingMinor: 0,
      todaySpendingMinor: 0,
    });
    expect(preview).not.toBeNull();
    expect(preview!.overMinor).toBe(25_000_00);
  });

  it("returns null when the draft matches the saved amount", () => {
    expect(
      previewMonthSavings({
        items: [],
        monthKey: "2026-09",
        draftMinor: 0,
        currentMinor: 0,
        currency: "THB",
        timeZone: "Asia/Bangkok",
        ledgerTransactions: [],
        saldoMinor: 10_000_00,
        cycleSpendingMinor: 0,
        todaySpendingMinor: 0,
      }),
    ).toBeNull();
  });
});
