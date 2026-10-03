import { describe, expect, it } from "vitest";
import { usesAlarmColor } from "./amount-tone";

describe("usesAlarmColor", () => {
  it("is true only for amounts strictly under 0", () => {
    expect(usesAlarmColor(-1)).toBe(true);
    expect(usesAlarmColor(0)).toBe(false);
    expect(usesAlarmColor(1)).toBe(false);
    expect(usesAlarmColor(null)).toBe(false);
    expect(usesAlarmColor(undefined)).toBe(false);
  });
});
