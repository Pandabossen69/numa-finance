import { afterEach, describe, expect, it } from "vitest";
import {
  lastPlanFocus,
  planFocusFromSteg,
  rememberPlanFocusFromHref,
  resetPlanFocusForTests,
} from "./plan-focus";

afterEach(() => {
  resetPlanFocusForTests();
});

describe("plan first-run focus", () => {
  it("names steg 2 and 3 in one Swedish sentence", () => {
    expect(planFocusFromSteg("inkomst").stepHint).toContain("Steg 2 av 3");
    expect(planFocusFromSteg("inkomst").focusAdd).toBe("income");
    expect(planFocusFromSteg("utgift").stepHint).toContain("Steg 3 av 3");
    expect(planFocusFromSteg("utgift").focusAdd).toBe("fixed");
    expect(planFocusFromSteg(null).focusAdd).toBeNull();
  });

  it("keeps ?steg= through SPA hrefs that only flip the Plan tab", () => {
    rememberPlanFocusFromHref("/plan?steg=inkomst");
    expect(lastPlanFocus().focusAdd).toBe("income");
    rememberPlanFocusFromHref("/plan");
    expect(lastPlanFocus().focusAdd).toBeNull();
  });
});
