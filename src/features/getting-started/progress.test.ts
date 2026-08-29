import { describe, expect, it } from "vitest";
import type { PlanItem } from "@/domain/finance";
import {
  buildGettingStartedView,
  gettingStartedProgressLabel,
  isPlanBill,
} from "./progress";

function item(partial: Partial<PlanItem> & Pick<PlanItem, "kind" | "cadence" | "name">): PlanItem {
  return {
    id: partial.id ?? "p1",
    userId: "u1",
    name: partial.name,
    kind: partial.kind,
    amountMinor: partial.amountMinor ?? 1000,
    currency: "THB",
    cadence: partial.cadence,
    nextDueAt: partial.nextDueAt ?? "2026-09-01T00:00:00.000Z",
    isActive: partial.isActive ?? true,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

const emptyUser = {
  email: "van@example.com",
  gettingStartedCompletedAt: null as string | null,
  gettingStartedCollapsed: false,
  hasSaldo: false,
  planItems: [] as PlanItem[],
  onboardingSaldoAt: null as string | null,
};

describe("buildGettingStartedView", () => {
  it("shows the card for an unmapped new user like Christian", () => {
    const view = buildGettingStartedView({
      ...emptyUser,
      email: "christianhultz1@gmail.com",
    });
    expect(view.visible).toBe(true);
    expect(view.doneCount).toBe(0);
    expect(view.allDone).toBe(false);
  });

  it("hides the card for Hugo even when the ledger is empty", () => {
    const view = buildGettingStartedView({
      ...emptyUser,
      email: "Qualityltf@gmail.com",
    });
    expect(view.visible).toBe(false);
  });

  it("hides the card once getting started is completed", () => {
    const view = buildGettingStartedView({
      ...emptyUser,
      hasSaldo: true,
      gettingStartedCompletedAt: "2026-08-27T12:00:00.000Z",
    });
    expect(view.visible).toBe(false);
  });

  it("hides the card for an existing ledger that never did first-run", () => {
    const view = buildGettingStartedView({
      ...emptyUser,
      hasSaldo: true,
      planItems: [
        item({ name: "Lön", kind: "expected", cadence: "income" }),
        item({ name: "Hyra", kind: "mandatory", cadence: "monthly" }),
      ],
    });
    expect(view.visible).toBe(false);
  });

  it("counts saldo, income, and bills and keeps the card reachable", () => {
    const view = buildGettingStartedView({
      ...emptyUser,
      hasSaldo: true,
      onboardingSaldoAt: "2026-08-27T12:00:00.000Z",
      planItems: [
        item({ name: "Lön", kind: "expected", cadence: "income" }),
      ],
    });
    expect(view.visible).toBe(true);
    expect(view.doneCount).toBe(2);
    expect(gettingStartedProgressLabel(view.doneCount, view.total)).toBe(
      "2 av 3 klara",
    );
    expect(view.steps[0]?.done).toBe(true);
    expect(view.steps[1]?.done).toBe(true);
    expect(view.steps[2]?.done).toBe(false);
    expect(view.steps[1]?.href).toBe("/plan?steg=inkomst");
    expect(view.steps[0]?.why).toBe("Så Hem visar läget just nu.");
    expect(view.steps[1]?.why).toBe("Lön eller CSN hör hemma i Plan.");
    expect(view.steps[2]?.why).toBe("Hyra och räkningar lägger du i Plan.");
  });

  it("treats non-savings plan rows as bills", () => {
    const hyra = item({ name: "Hyra", kind: "mandatory", cadence: "monthly" });
    const spara = item({
      name: "Spara denna månad",
      kind: "goal",
      cadence: "savings",
    });
    expect(isPlanBill(hyra)).toBe(true);
    expect(isPlanBill(spara)).toBe(false);
  });
});
