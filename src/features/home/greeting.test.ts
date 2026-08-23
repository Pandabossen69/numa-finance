import { describe, expect, it } from "vitest";
import { homeGreeting } from "./mock-snapshot";

describe("homeGreeting", () => {
  it("uses Bangkok evening, not the machine clock", () => {
    // 22:23 Bangkok = 15:23 UTC
    const evening = new Date("2026-08-23T15:23:00.000Z");
    expect(homeGreeting("Hugo", evening, "Asia/Bangkok")).toBe("God kväll Hugo");
  });

  it("says God morgon before 11 in Bangkok and keeps sentence case", () => {
    const morning = new Date("2026-08-23T02:30:00.000Z");
    expect(homeGreeting("Hugo", morning, "Asia/Bangkok")).toBe("God morgon Hugo");
    expect(homeGreeting("Hugo", morning, "Asia/Bangkok")).not.toMatch(/Morgon/);
  });
});
