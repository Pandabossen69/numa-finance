import { describe, expect, it } from "vitest";
import { SV } from "./labels-sv";

describe("Swedish money labels", () => {
  it("never calls the plan leftover pile Saldo or Allt i NUMA", () => {
    expect(SV.motPlanen).toBe("Mot planen");
    expect(SV.alltINuma).toBe("Plan + sparande");
    expect(SV.paKontot).toBe("På kontot");
    expect(SV.saldo).toBe("Saldo");
    expect(SV.motPlanen).not.toBe(SV.saldo);
    expect(SV.alltINuma.toLowerCase()).not.toMatch(/allt i numa/);
    expect(SV.kvarIManadenPlan).toMatch(/plan/i);
  });
});
