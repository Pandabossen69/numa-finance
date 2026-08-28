import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./MovementsScreen.tsx", import.meta.url), "utf8");

describe("Rörelser expense color", () => {
  it("paints Utgifter and negative Netto in clay alarm", () => {
    expect(src).toContain('label="Utgifter"');
    expect(src).toContain('tone="alarm"');
    expect(src).toContain('tone={net >= 0 ? "positive" : "alarm"}');
    expect(src).not.toMatch(/label="Utgifter"[\s\S]{0,80}tone="danger"/);
  });

  it("blocks Spara and Ta bort while a mutation is in flight", () => {
    expect(src).toContain('useState<"save" | "void" | null>');
    expect(src).toContain("if (actionLock.current || pendingAction) return");
    expect(src).toContain("disabled={pendingAction != null}");
    expect(src).toContain('{pendingAction === "save" ? "Sparar…" : "Spara"}');
    expect(src).toContain('{pendingAction === "void" ? "Tar bort…" : "Ta bort"}');
  });

  it("asks for an in-DOM confirm before Ta bort", () => {
    expect(src).toContain("confirmId");
    expect(src).toContain("setConfirmId(tx.id)");
    expect(src).not.toContain("window.confirm");
    expect(src).toContain('event.key === "Escape"');
    expect(src).toContain("confirmId == null || confirmId === tx.id");
  });

  it("formats edit amounts with a Swedish comma", () => {
    expect(src).toContain("minorToUiAmount");
    expect(src).not.toContain("toFixed(2)");
  });

  it("gives Rörelser chips a 44px tap target", () => {
    expect(src).toContain("min-h-11 rounded-full");
    expect(src).not.toContain("min-h-10 rounded-full");
  });

  it("keeps period and filter chips equal and stats off a phone 3-up", () => {
    expect(src).toContain("numa-equal-chips");
    expect(src).toContain("is-quad");
    expect(src).toContain("numa-stat-trio");
    expect(src).toContain("numa-money-line");
    expect(src).toContain("wrap={false}");
    expect(src).not.toContain("sm:grid-cols-3");
    expect(src).toContain("overflow-x-hidden");
  });

  it("shows last-known Rörelser instead of blocking on a cold fetch", () => {
    expect(src).toContain("lastMovementsSnapshot");
    expect(src).toContain("rememberMovementsSnapshot");
    expect(src).toContain("MovementsViewLoading");
    expect(src).toContain("lastMovementsView");
    expect(src).toContain("applyMovementsEdit");
    expect(src).toContain("applyMovementsVoid");
    expect(src).not.toContain("refreshQuiet");
    expect(src).not.toContain("router.refresh");
    expect(src).not.toContain("useRouter");
  });
});
