import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isRepairDoneSearch,
  lagaStartsIdle,
  nextLagaPhase,
} from "./repair";

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

  it("clears caches without SKIP_WAITING (avoids iOS reload race)", () => {
    expect(src).toContain("caches.delete");
    expect(src).toContain("reloadRepairSuccessPage");
    expect(src).not.toContain("SKIP_WAITING");
    expect(src).not.toContain("reg.update");
    expect(src).not.toMatch(/\b\w+\.unregister\s*\(/);
  });

  it("detects the success query", () => {
    expect(isRepairDoneSearch("?updated=1")).toBe(true);
    expect(isRepairDoneSearch("?updated=0")).toBe(false);
    expect(isRepairDoneSearch("")).toBe(false);
  });
});
