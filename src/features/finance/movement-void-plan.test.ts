import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { invalidateAfterPlanLinkedVoid } from "./movement-void-plan";

const screen = readFileSync(
  new URL("../../components/movements/MovementsScreen.tsx", import.meta.url),
  "utf8",
);

describe("void of a plan-linked movement", () => {
  it("invalidates Plan and Hem after delete/void of a settle booking", () => {
    const invalidate = vi.fn();
    expect(
      invalidateAfterPlanLinkedVoid(
        { planItemId: "plan-1", ledgerOrigin: "plan_settle" },
        invalidate,
      ),
    ).toBe(true);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("invalidates when the row is only linked, not a synthetic settle", () => {
    const invalidate = vi.fn();
    expect(
      invalidateAfterPlanLinkedVoid(
        { linkedPlanItemId: "plan-2", ledgerOrigin: "external" },
        invalidate,
      ),
    ).toBe(true);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("Rörelser calls invalidation after a successful Ta bort", () => {
    expect(screen).toContain("invalidateAfterPlanLinkedVoid(tx)");
    const voidAt = screen.indexOf("voidTransactionAction");
    const callAt = screen.indexOf("invalidateAfterPlanLinkedVoid(tx)");
    expect(voidAt).toBeGreaterThan(-1);
    expect(callAt).toBeGreaterThan(voidAt);
  });

  it("does not invalidate an ordinary expense", () => {
    const invalidate = vi.fn();
    expect(
      invalidateAfterPlanLinkedVoid(
        { planItemId: null, linkedPlanItemId: null, ledgerOrigin: "external" },
        invalidate,
      ),
    ).toBe(false);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
