import { describe, expect, it } from "vitest";
import {
  calculateDayPulse,
  describeDayClose,
  isDayOnTrack,
  rankForOnTrackDays,
} from "@/domain/gamification";
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

describe("isDayOnTrack", () => {
  it("counts plus as on track", () => {
    expect(isDayOnTrack("plus")).toBe(true);
  });

  it("counts even as on track", () => {
    expect(isDayOnTrack("even")).toBe(true);
  });

  it("does not count minus as on track", () => {
    expect(isDayOnTrack("minus")).toBe(false);
  });
});

describe("describeDayClose", () => {
  it("gives calm feedback when the day is already closed with a streak", () => {
    const feedback = describeDayClose({
      status: "plus",
      alreadyClosedToday: true,
      currentStreak: 4,
    });
    expect(feedback.headlineSv).toBe("Redan avslutad");
    expect(feedback.bodySv).toContain("4 dagar");
  });

  it("gives calm feedback when the day is already closed with no streak yet", () => {
    const feedback = describeDayClose({
      status: "minus",
      alreadyClosedToday: true,
      currentStreak: 0,
    });
    expect(feedback.headlineSv).toBe("Redan avslutad");
    expect(feedback.bodySv).not.toContain("Streak");
  });

  it("celebrates an on-track close with the updated streak", () => {
    const feedback = describeDayClose({
      status: "even",
      alreadyClosedToday: false,
      currentStreak: 1,
    });
    expect(feedback.headlineSv).toBe("Dagens läge sparat");
    expect(feedback.bodySv).toContain("1 dag");
    expect(feedback.bodySv).not.toContain("1 dagar");
  });

  it("stays calm (no streak break language) when closing a minus day", () => {
    const feedback = describeDayClose({
      status: "minus",
      alreadyClosedToday: false,
      currentStreak: 0,
    });
    expect(feedback.headlineSv).toBe("Dagens läge sparat");
    expect(feedback.bodySv).toContain("minus");
    expect(feedback.bodySv).not.toContain("Streak");
  });
});
