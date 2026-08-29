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

  it("greets an unmapped full name with the first name only", () => {
    const midday = new Date("2026-08-23T06:00:00.000Z");
    expect(homeGreeting("Christian Hultz", midday, "Asia/Bangkok")).toBe(
      "Hej Christian",
    );
    expect(homeGreeting("Användare", midday, "Asia/Bangkok")).toBe("Hej");
    expect(
      homeGreeting("christianhultz1@gmail.com", midday, "Asia/Bangkok"),
    ).toBe("Hej");
  });
});
