import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lagaStartsIdle, nextLagaPhase } from "./repair";

const src = readFileSync(new URL("./repair.ts", import.meta.url), "utf8");

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

  it("updates the worker instead of unregistering (iOS-safe)", () => {
    expect(src).toContain("reg.update()");
    expect(src).toContain("SKIP_WAITING");
    expect(src).toContain("navigateAfterRepair");
    expect(src).toContain("location.assign");
    expect(src).not.toMatch(/\b\w+\.unregister\s*\(/);
  });
});
