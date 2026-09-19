import { describe, expect, it } from "vitest";
import { SV } from "@/features/copy/labels-sv";
import { isLowKvarToday, lowKvarNextAction, type LowKvarCtaInput } from "./low-kvar-cta";

function input(partial: Partial<LowKvarCtaInput> = {}): LowKvarCtaInput {
  return {
    dayBudgetMinor: 800_00,
    remainingTodayMinor: 100_00,
    livingMode: "cycle",
    needsAvailableInput: false,
    hasPrimaryAccount: true,
    ...partial,
  };
}

describe("isLowKvarToday", () => {
  it("is false without a dagsbudget", () => {
    expect(isLowKvarToday(0, 0)).toBe(false);
    expect(isLowKvarToday(-50_00, 0)).toBe(false);
  });

  it("treats Kvar ≤ 0 as low", () => {
    expect(isLowKvarToday(0, 800_00)).toBe(true);
    expect(isLowKvarToday(-1, 800_00)).toBe(true);
  });

  it("is true strictly under 20% of dagsbudget, not at the 20% line", () => {
    expect(isLowKvarToday(159_99, 800_00)).toBe(true);
    expect(isLowKvarToday(160_00, 800_00)).toBe(false);
    expect(isLowKvarToday(161_00, 800_00)).toBe(false);
    expect(isLowKvarToday(800_00, 800_00)).toBe(false);
  });
});

describe("lowKvarNextAction", () => {
  it("stays quiet when Kvar is healthy", () => {
    expect(lowKvarNextAction(input({ remainingTodayMinor: 400_00 }))).toBeNull();
    expect(lowKvarNextAction(input({ remainingTodayMinor: 160_00 }))).toBeNull();
  });

  it("does not steal empty / saldo-input Hem", () => {
    expect(lowKvarNextAction(input({ livingMode: "empty" }))).toBeNull();
    expect(lowKvarNextAction(input({ needsAvailableInput: true }))).toBeNull();
  });

  it("shows Lägg utgift when a little Kvar is left and a konto exists", () => {
    const cta = lowKvarNextAction(input({ remainingTodayMinor: 100_00 }));
    expect(cta).toEqual({
      kind: "expense",
      href: "#lagg-utgift",
      label: SV.laggUtgift,
      hint: SV.laggUtgiftHintLowKvar,
    });
    expect(cta?.label).toBe("Lägg utgift");
  });

  it("shows Öppna Plan when Kvar is 0 or over", () => {
    expect(lowKvarNextAction(input({ remainingTodayMinor: 0 }))).toMatchObject({
      kind: "plan",
      href: "/plan",
      label: "Öppna Plan",
    });
    expect(lowKvarNextAction(input({ remainingTodayMinor: -80_00 }))).toMatchObject({
      kind: "plan",
      href: "/plan",
      label: "Öppna Plan",
    });
  });

  it("falls back to Öppna Plan when there is no konto to log against", () => {
    const cta = lowKvarNextAction(
      input({ remainingTodayMinor: 50_00, hasPrimaryAccount: false }),
    );
    expect(cta?.kind).toBe("plan");
    expect(cta?.href).toBe("/plan");
  });

  it("works the same in bridge as in cycle — no money math", () => {
    const cycle = lowKvarNextAction(input({ livingMode: "cycle" }));
    const bridge = lowKvarNextAction(input({ livingMode: "bridge" }));
    expect(bridge).toEqual(cycle);
  });
});
