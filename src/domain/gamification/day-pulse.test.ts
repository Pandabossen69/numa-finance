import { describe, expect, it } from "vitest";
import { calculateDayPulse, rankForOnTrackDays } from "@/domain/gamification";
import { money } from "@/domain/money";

describe("day pulse", () => {
  it("marks plus when under today's plan", () => {
    const pulse = calculateDayPulse({
      plannedToday: money(90000, "THB"),
      spentToday: money(25000, "THB"),
    });
    expect(pulse.status).toBe("plus");
    expect(pulse.delta.amountMinor).toBe(65000);
    expect(pulse.usedPercent).toBe(28);
  });

  it("marks minus when over today's plan", () => {
    const pulse = calculateDayPulse({
      plannedToday: money(90000, "THB"),
      spentToday: money(120000, "THB"),
    });
    expect(pulse.status).toBe("minus");
    expect(pulse.delta.amountMinor).toBe(-30000);
    expect(pulse.usedPercent).toBe(133);
  });

  it("resolves ranks from on-track days", () => {
    expect(rankForOnTrackDays(0).id).toBe("start");
    expect(rankForOnTrackDays(3).id).toBe("stadig");
    expect(rankForOnTrackDays(30).id).toBe("mästare");
  });
});
