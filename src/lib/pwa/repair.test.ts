import { describe, expect, it } from "vitest";
import { lagaStartsIdle, nextLagaPhase } from "./repair";

describe("/laga repair flow", () => {
  it("never auto-starts clearing", () => {
    expect(lagaStartsIdle()).toBe(true);
    expect(nextLagaPhase("idle", "success")).toBe("idle");
    expect(nextLagaPhase("idle", "fail")).toBe("idle");
  });

  it("requires an explicit confirm before running", () => {
    expect(nextLagaPhase("idle", "ask")).toBe("confirm");
    expect(nextLagaPhase("confirm", "cancel")).toBe("idle");
    expect(nextLagaPhase("running", "success")).toBe("done");
    expect(nextLagaPhase("running", "fail")).toBe("error");
  });
});
