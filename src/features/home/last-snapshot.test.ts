import { describe, expect, it } from "vitest";
import {
  lastAnalysScope,
  lastPlanView,
  rememberAnalysScope,
  rememberPlanView,
} from "./last-snapshot";

describe("last view memory", () => {
  it("keeps Plan month and Analys scope across remounts", () => {
    rememberPlanView({ monthKey: "2027-03", viewYear: 2027 });
    rememberAnalysScope("month");
    expect(lastPlanView()).toEqual({ monthKey: "2027-03", viewYear: 2027 });
    expect(lastAnalysScope()).toBe("month");
  });
});
